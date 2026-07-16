import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BookOpen,
  CaretLeft,
  CheckCircle,
  Link as LinkIcon,
  NotePencil,
  Trash,
  XCircle,
} from "phosphor-react-native";

import AppBlur from "../../../components/ui/AppBlur";
import BottomSheet, { SheetScrollView } from "../../../components/ui/BottomSheet";
import SettingsActionRow from "../../../components/ui/SettingsKit/SettingsActionRow";
import SettingsGroup from "../../../components/ui/SettingsKit/SettingsGroup";
import SettingsRow from "../../../components/ui/SettingsKit/SettingsRow";
import { useScheduleData } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import { generateId } from "../../../utils/idGenerator";
import { t } from "../../../utils/i18n";
import LinkEditor from "../../Schedule/components/LessonEditor/forms/LinkForm";
import LessonEditorPickerScreen from "../../Schedule/components/LessonEditor/screens/PickerScreen";

const NO_SUBJECT_KEY = "__no_subject__";

const deepCloneArray = (value) => JSON.parse(JSON.stringify(Array.isArray(value) ? value : []));

const sanitizeIdArray = (value) => (
  Array.isArray(value)
    ? [...new Set(value.filter(Boolean))]
    : []
);

export default function TaskEditor({ task, sourceSchedule, onSave, onDelete, onClose }) {
  const { global, schedule, lang } = useScheduleData();
  const sheetRef = useRef(null);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  const taskSchedule = sourceSchedule || schedule;

  const subjects = useMemo(() => (
    Array.isArray(taskSchedule?.subjects) ? taskSchedule.subjects : []
  ), [taskSchedule?.subjects]);

  const [currentScreen, setCurrentScreen] = useState("main");
  const [selectedSubjectId, setSelectedSubjectId] = useState(task?.subjectId || null);
  const [text, setText] = useState(task?.text || "");
  const [selectedLinks, setSelectedLinks] = useState(() => sanitizeIdArray(task?.links));
  const [localLinks, setLocalLinks] = useState(() => deepCloneArray(taskSchedule?.links));
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const minimizeAnim = useRef(new Animated.Value(0)).current;

  const handleExpand = () => {
    Animated.timing(minimizeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => setIsMinimized(false));
  };

  const handleCloseMinimized = () => {
    Animated.timing(minimizeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => onClose?.());
  };

  useEffect(() => {
    setCurrentScreen("main");
    setSelectedSubjectId(task?.subjectId || null);
    setText(task?.text || "");
    setSelectedLinks(sanitizeIdArray(task?.links));
    setLocalLinks(deepCloneArray(taskSchedule?.links));
    setEditingLinkId(null);

    if (isMinimized) {
      handleExpand();
    }
  }, [task, taskSchedule?.links]);

  useEffect(() => {
    if (isMinimized) {
      Animated.spring(minimizeAnim, {
        toValue: 1,
        stiffness: 300,
        damping: 20,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    } else {
      minimizeAnim.setValue(0);
    }
  }, [isMinimized, minimizeAnim]);

  if (!taskSchedule) return null;

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const resolvedSubjectId = selectedSubject ? selectedSubjectId : null;
  const selectedLinkObjects = selectedLinks
    .map((id) => localLinks.find((link) => link.id === id))
    .filter(Boolean);
  const canSave = text.trim().length > 0;

  const getScreenTitle = () => {
    if (currentScreen === "subjectPicker") return t("tasks.editor.subject", lang);
    if (currentScreen === "linkPicker") return t("tasks.editor.links", lang);
    if (currentScreen === "linkEditor") return t("tasks.editor.edit_link", lang);
    return task?.id ? t("tasks.editor.edit_task", lang) : t("tasks.editor.new_task", lang);
  };

  const goBack = () => {
    if (currentScreen === "linkEditor") {
      setCurrentScreen("linkPicker");
      return;
    }
    setCurrentScreen("main");
  };

  const closeSheet = () => {
    sheetRef.current?.close();
  };

  const dismissEditor = () => {
    if (isMinimized) {
      handleCloseMinimized();
      return;
    }

    closeSheet();
  };

  const handleSave = () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const now = Date.now();
    const taskId = task?.id || generateId();
    const nextTask = {
      id: taskId,
      subjectId: resolvedSubjectId,
      text: trimmedText,
      links: sanitizeIdArray(selectedLinks),
      completed: task?.completed === true,
      createdAt: task?.createdAt || now,
      updatedAt: now,
    };

    onSave?.({
      scheduleId: taskSchedule.id,
      task: nextTask,
      links: localLinks,
    });

    dismissEditor();
  };

  const deleteTask = () => {
    if (!task?.id) return;

    onDelete?.(taskSchedule.id, task.id);
    dismissEditor();
  };

  const handleDelete = () => {
    Alert.alert(
      t("common.warning", lang),
      t("tasks.editor.delete_confirm", lang),
      [
        { text: t("common.cancel", lang), style: "cancel" },
        { text: t("common.delete", lang), style: "destructive", onPress: deleteTask },
      ]
    );
  };

  const handleSaveLink = (updatedLink) => {
    setLocalLinks((prev) => {
      const exists = prev.some((link) => link.id === updatedLink.id);
      return exists
        ? prev.map((link) => (link.id === updatedLink.id ? updatedLink : link))
        : [...prev, updatedLink];
    });
    setSelectedLinks((prev) => sanitizeIdArray([...prev, updatedLink.id]));
    setCurrentScreen("linkPicker");
  };

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
      {currentScreen === "main" ? (
        <TouchableOpacity onPress={closeSheet} hitSlop={15}>
          <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>{t("common.cancel", lang)}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={15}>
          <CaretLeft size={24} color={themeColors.accentColor} weight="bold" />
          <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>{t("common.back", lang)}</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.headerTitle, { color: themeColors.textColor }]} numberOfLines={1}>
        {getScreenTitle()}
      </Text>

      <View style={styles.headerRight}>
        {currentScreen === "main" && (
          <TouchableOpacity onPress={handleSave} disabled={!canSave} hitSlop={15}>
            <Text style={{ color: canSave ? themeColors.accentColor : themeColors.textColor2, fontSize: 17, fontWeight: "600" }}>
              {t("common.done", lang)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderLinksValue = () => {
    if (selectedLinkObjects.length === 0) return t("tasks.editor.no_links", lang);
    return t("tasks.editor.links_count", lang).replace("{count}", String(selectedLinkObjects.length));
  };

  const renderMain = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      enabled={Platform.OS === "ios"}
      keyboardVerticalOffset={110}
    >
      <SheetScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SettingsGroup themeColors={themeColors} title={t("tasks.editor.subject", lang)}>
          <SettingsRow
            label={t("tasks.editor.subject", lang)}
            value={selectedSubject?.name || t("tasks.editor.no_subject", lang)}
            onPress={() => setCurrentScreen("subjectPicker")}
            themeColors={themeColors}
            icon={BookOpen}
          />
        </SettingsGroup>

        <SettingsGroup themeColors={themeColors} title={t("tasks.editor.task_text", lang)}>
          <View style={[styles.textAreaWrap, { backgroundColor: themeColors.backgroundColor2 }]}>
            <NotePencil size={22} color={themeColors.textColor2} weight="bold" style={styles.textAreaIcon} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t("tasks.editor.task_text_placeholder", lang)}
              placeholderTextColor={themeColors.textColor2 + "80"}
              style={[styles.textArea, { color: themeColors.textColor }]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </SettingsGroup>

        <SettingsGroup themeColors={themeColors} title={t("tasks.editor.links", lang)}>
          <SettingsRow
            label={t("tasks.editor.attach_links", lang)}
            value={renderLinksValue()}
            onPress={() => setCurrentScreen("linkPicker")}
            themeColors={themeColors}
            icon={LinkIcon}
          />

          {selectedLinkObjects.map((link) => (
            <SettingsRow
              key={link.id}
              label={link.name || t("tasks.default_link", lang)}
              desc={link.url}
              onPress={() => {
                setEditingLinkId(link.id);
                setCurrentScreen("linkEditor");
              }}
              themeColors={themeColors}
              icon={LinkIcon}
            />
          ))}
        </SettingsGroup>

        {task?.id && (
          <SettingsActionRow
            icon={Trash}
            label={t("tasks.editor.delete_task", lang)}
            onPress={handleDelete}
            danger
            themeColors={themeColors}
          />
        )}
      </SheetScrollView>
    </KeyboardAvoidingView>
  );

  const minimizedTitle = task?.id ? t("tasks.editor.edit_task", lang) : t("tasks.editor.new_task", lang);
  const minimizedSubtitle = selectedSubject?.name || text.trim() || t("tasks.editor.no_subject", lang);

  return (
    <>
      {isMinimized && (
        <View style={styles.minimizedOverlay} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.minimizedBar,
              { borderColor: themeColors.borderColor, backgroundColor: "transparent" },
              {
                opacity: minimizeAnim,
                transform: [
                  {
                    translateY: minimizeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                  {
                    scale: minimizeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: "hidden" }]}>
              <AppBlur style={StyleSheet.absoluteFill} intensity={80} />
            </View>

            <TouchableOpacity
              style={styles.minimizedContent}
              onPress={handleExpand}
              activeOpacity={0.7}
            >
              <View style={[styles.minimizedIcon, { backgroundColor: themeColors.accentColor + "20" }]}>
                <NotePencil size={18} color={themeColors.accentColor} weight="bold" />
              </View>
              <View style={styles.minimizedText}>
                <Text style={[styles.minimizedTitle, { color: themeColors.textColor }]} numberOfLines={1}>
                  {minimizedTitle}
                </Text>
                <Text style={[styles.minimizedSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
                  {minimizedSubtitle}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.minimizedActions}>
              {canSave && (
                <TouchableOpacity onPress={handleSave} style={styles.minimizedActionBtn}>
                  <CheckCircle size={30} color={themeColors.accentColor} weight="fill" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleCloseMinimized} style={[styles.minimizedActionBtn, { marginLeft: 2 }]}>
                <XCircle size={30} color={themeColors.accentColor} weight="fill" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        visible={!isMinimized}
        onClose={onClose}
        onMinimize={() => setIsMinimized(true)}
        snapPoints={["62%", "92%"]}
        initialSnapIndex={1}
        maxWidth={800}
        backgroundColor={themeColors.backgroundColor}
        handleColor={themeColors.borderColor || "#ccc"}
        header={renderHeader()}
        enableContentPanningGesture={false}
        accessibilityLabel={getScreenTitle()}
        closeAccessibilityLabel={t("common.close", lang)}
        testID="task-editor-sheet"
      >
        <View style={{ flex: 1 }}>
          {currentScreen === "main" && renderMain()}

          {currentScreen === "subjectPicker" && (
            <LessonEditorPickerScreen
              options={[
                { key: NO_SUBJECT_KEY, label: t("tasks.editor.no_subject", lang) },
                ...subjects.map((subject) => ({ key: subject.id, label: subject.name })),
              ]}
              selectedValues={[resolvedSubjectId || NO_SUBJECT_KEY]}
              multiSelect={false}
              onSave={(key) => {
                setSelectedSubjectId(key === NO_SUBJECT_KEY ? null : key);
                setCurrentScreen("main");
              }}
              themeColors={themeColors}
            />
          )}

          {currentScreen === "linkPicker" && (
            <LessonEditorPickerScreen
              options={localLinks.map((link) => ({ key: link.id, label: link.name || t("tasks.default_link", lang) }))}
              selectedValues={selectedLinks}
              multiSelect
              onSave={(keys) => {
                setSelectedLinks(sanitizeIdArray(keys));
                setCurrentScreen("main");
              }}
              onEdit={(id) => {
                setEditingLinkId(id);
                setCurrentScreen("linkEditor");
              }}
              onAdd={() => {
                setEditingLinkId(generateId());
                setCurrentScreen("linkEditor");
              }}
              themeColors={themeColors}
            />
          )}

          {currentScreen === "linkEditor" && (
            <LinkEditor
              linkId={editingLinkId}
              localLinkData={localLinks.find((link) => link.id === editingLinkId) || {}}
              onSaveLocal={handleSaveLink}
              onBack={goBack}
              themeColors={themeColors}
            />
          )}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: -8,
  },
  minimizedOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 88,
    zIndex: 999,
  },
  minimizedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 6,
    paddingLeft: 8,
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0,0,0,0.15)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  minimizedContent: {
    flex: 1,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  minimizedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  minimizedText: {
    flex: 1,
    paddingRight: 5,
  },
  minimizedTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  minimizedSubtitle: {
    fontSize: 11,
  },
  minimizedActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
    zIndex: 10,
  },
  minimizedActionBtn: {
    padding: 2,
  },
  headerRight: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },
  textAreaWrap: {
    minHeight: 132,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
  },
  textAreaIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  textArea: {
    flex: 1,
    minHeight: 108,
    fontSize: 16,
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
  },
});
