import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Alert
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { 
  X, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Link as LinkIcon, 
  ArrowUpRight, 
  DownloadSimple,
  CheckSquare,
  Plus,
  Paperclip,
  ShareNetwork,
  Trash, 
  PencilSimple 
} from "phosphor-react-native";
import { useScheduleActions, useScheduleData } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/ui/GradientBackground";
import { getIconComponent } from "../../../config/subjectIcons";
import { t } from "../../../utils/i18n";
import BottomSheet, { SheetScrollView } from "../../../components/ui/BottomSheet";
import AttachmentImagePreview from "../../../components/attachments/AttachmentImagePreview";
import { triggerHaptic } from "../../../utils/haptics";
import {
  deleteStoredAttachments,
  formatAttachmentError,
  formatFileSize,
  getAttachmentShareLabel,
  isImageAttachment,
  openAttachment,
  resolveAttachmentList,
  shareAttachment,
} from "../../../services/attachmentService";

export default function LessonViewer({
  visible,
  lesson,
  relatedTasks = [],
  onClose,
  onEdit,
  onAddTask,
}) {
  const { schedule, global, lang } = useScheduleData();
  const { setScheduleDraft } = useScheduleActions();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();
  const insets = useSafeAreaInsets();
  const [previewAttachment, setPreviewAttachment] = useState(null);
  
  if (!lesson) return null;

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const subjects = Array.isArray(schedule?.subjects) ? schedule.subjects : [];
  const teachers = Array.isArray(schedule?.teachers) ? schedule.teachers : [];
  const links = Array.isArray(schedule?.links) ? schedule.links : [];
  const gradients = Array.isArray(schedule?.gradients) ? schedule.gradients : [];

  const subjectId = lesson.subjectId;
  const fullSubject = subjects.find(s => s.id === subjectId) || {};

  const instanceData = lesson.data || {};

  const displayType = instanceData.type || fullSubject.type;

  const displayRoom = instanceData.room || fullSubject.room;
  const displayBuilding = instanceData.building || fullSubject.building;

  const hasLocalTeachers = instanceData.teachers !== undefined;
  const rawTeacherIds = hasLocalTeachers 
      ? instanceData.teachers 
      : (fullSubject.teachers || (fullSubject.teacher ? [fullSubject.teacher] : []));
  
  const validTeacherIds = Array.isArray(rawTeacherIds) 
      ? rawTeacherIds.filter(id => id && id !== 0 && id !== "0") 
      : [];
  const displayTeachers = teachers.filter(t => validTeacherIds.includes(t.id));

  const hasLocalLinks = instanceData.links !== undefined;
  const rawLinkIds = hasLocalLinks ? instanceData.links : (fullSubject.links || []);
  
  const validLinkIds = Array.isArray(rawLinkIds) ? rawLinkIds : [];
  const displayLinks = links.filter(l => validLinkIds.includes(l.id));
  const hasLocalAttachments = instanceData.attachments !== undefined;
  const rawAttachments = hasLocalAttachments ? instanceData.attachments : fullSubject.attachments;
  const displayAttachments = resolveAttachmentList(rawAttachments, global?.fileLibrary);

  const getHeaderBackground = () => {
    if (fullSubject.typeColor === "gradient" && fullSubject.colorGradient) {
      const grad = gradients.find(g => g.id === fullSubject.colorGradient);
      if (grad) return <GradientBackground gradient={grad} style={styles.headerBackground} />;
    }
    const color = themes.accentColors[fullSubject.color] || themeColors.accentColor;
    return <View style={[styles.headerBackground, { backgroundColor: color }]} />;
  };

  const MainIcon = getIconComponent(fullSubject.icon);

  const handleLinkPress = async (url) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      triggerHaptic("open");
      Linking.openURL(url);
    } else {
      triggerHaptic("error");
      alert(`${t('schedule.lesson_viewer.link_error', lang)}${url}`);
    }
  };

  const handleAttachmentPress = async (attachment, download = false) => {
    try {
      triggerHaptic("open");
      if (!download && isImageAttachment(attachment)) {
        setPreviewAttachment(attachment);
        return;
      }
      await openAttachment(attachment, { download });
    } catch (error) {
      triggerHaptic("error");
      Alert.alert(t('common.error', lang), t('attachments.errors.open_failed', lang));
    }
  };

  const handleAttachmentShare = async (attachment) => {
    try {
      triggerHaptic("open");
      await shareAttachment(attachment);
    } catch (error) {
      triggerHaptic("error");
      Alert.alert(t('common.error', lang), formatAttachmentError(error, lang));
    }
  };

  const handleDelete = () => {
    triggerHaptic("warning");
    Alert.alert(
      t('common.warning', lang),
      (t('common.delete', lang)) + "?",
      [
        { text: t('common.cancel', lang), style: 'cancel' },
        { 
          text: t('common.delete', lang), 
          style: 'destructive',
          onPress: () => {
            triggerHaptic("success");
            setScheduleDraft((prev) => {
              const next = { ...prev };
              const dayIndex = getDayIndex(currentDate);
              const weekKey = `week${calculateCurrentWeek(currentDate)}`;

              if (next.schedule && next.schedule[dayIndex] && next.schedule[dayIndex][weekKey]) {
                 const weekArr = [...next.schedule[dayIndex][weekKey]];
                 if (Number.isInteger(lesson.index)) {
                   weekArr.splice(lesson.index, 1);
                 }
                 next.schedule[dayIndex][weekKey] = weekArr;
              }
              return next;
            });
            deleteStoredAttachments(instanceData.attachments).catch(() => {});
            onClose();
          }
        }
      ]
    );
  };

  const handleClose = () => {
    triggerHaptic("sheetClose");
    onClose?.();
  };

  const visibleRelatedTasks = Array.isArray(relatedTasks) ? relatedTasks.slice(0, 3) : [];

  return (
    <>
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={["50%", "78%"]}
      initialSnapIndex={1}
      maxWidth={700}
      backgroundColor={themeColors.backgroundColor}
      handleColor={themeColors.textColor3}
      accessibilityLabel={fullSubject.name || t('schedule.lesson_viewer.untitled', lang)}
      closeAccessibilityLabel={t('common.close', lang)}
      testID="lesson-viewer-sheet"
    >
          <View style={styles.headerContainer}>
            {getHeaderBackground()}
            
            <View style={styles.headerContent}>
              {MainIcon ? (
                <View style={styles.iconCircle}>
                   <MainIcon size={32} color={themeColors.backgroundColor} weight="fill" />
                </View>
              ) : (
                <View />
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <X size={24} color="#fff" weight="bold" />
              </TouchableOpacity>
            </View>
          </View>

          <SheetScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            
            <View style={styles.titleSection}>
              {!!displayType && (
                <View style={[styles.typeBadge, { borderColor: themeColors.accentColor }]}>
                  <Text style={[styles.typeText, { color: themeColors.accentColor }]}>
                    {displayType.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.subjectName, { color: themeColors.textColor }]}>
                {fullSubject.name || t('schedule.lesson_viewer.untitled', lang)}
              </Text>
              {!!fullSubject.fullName && (
                <Text style={[styles.subjectFullName, { color: themeColors.textColor2 }]}>
                  {fullSubject.fullName}
                </Text>
              )}
            </View>

            <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />

            <View style={styles.gridRow}>
              <View style={[styles.gridItem, { backgroundColor: themeColors.backgroundColor2 }]}>
                <Clock size={22} color={themeColors.accentColor} weight="regular" />
                <View style={styles.gridTextContainer}>
                  <Text style={[styles.gridLabel, { color: themeColors.textColor2 }]}>
                    {t('schedule.lesson_viewer.time', lang)}
                  </Text>
                  <Text style={[styles.gridValue, { color: themeColors.textColor }]}>
                    {lesson.timeInfo?.start} - {lesson.timeInfo?.end}
                  </Text>
                </View>
              </View>

              <View style={[styles.gridItem, { backgroundColor: themeColors.backgroundColor2 }]}>
                <MapPin size={22} color={themeColors.accentColor} weight="regular" />
                <View style={styles.gridTextContainer}>
                  <Text style={[styles.gridLabel, { color: themeColors.textColor2 }]}>
                    {t('schedule.lesson_viewer.room', lang)}
                  </Text>
                  <Text style={[styles.gridValue, { color: themeColors.textColor }]} numberOfLines={1}>
                    {displayBuilding ? `${displayBuilding}, ` : ""}{displayRoom || "—"}
                  </Text>
                </View>
              </View>
            </View>

            {displayTeachers.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>
                  {t('schedule.lesson_viewer.teachers', lang)}
                </Text>
                {displayTeachers.map((teacher, index) => (
                  <View key={index} style={[styles.rowCard, { backgroundColor: themeColors.backgroundColor2 }]}>
                    <View style={[styles.rowIcon, { backgroundColor: themeColors.backgroundColor3 }]}>
                      <User size={18} color={themeColors.textColor} weight="fill" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: themeColors.textColor }]}>{teacher.name}</Text>
                      {teacher.phone ? <Text style={[styles.rowSubtitle, { color: themeColors.textColor2 }]}>{teacher.phone}</Text> : null}
                    </View>
                    {!!teacher.phone && (
                        <TouchableOpacity
                          onPress={() => {
                            triggerHaptic("open");
                            Linking.openURL(`tel:${teacher.phone}`);
                          }}
                          hitSlop={10}
                        >
                            <Phone size={22} color={themeColors.accentColor} style={{marginRight: 8}} weight="regular" />
                        </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {displayLinks.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>
                  {t('schedule.lesson_viewer.materials', lang)}
                </Text>
                {displayLinks.map((link, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.rowCard, { backgroundColor: themeColors.backgroundColor2 }]}
                    onPress={() => handleLinkPress(link.url)}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: themeColors.backgroundColor3 }]}>
                      <LinkIcon size={18} color={themeColors.accentColor} weight="bold" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: themeColors.accentColor, textDecorationLine: 'underline' }]}>
                        {link.name || t('schedule.lesson_viewer.default_link', lang)}
                      </Text>
                      <Text style={[styles.rowSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
                        {link.url}
                      </Text>
                    </View>
                    <ArrowUpRight size={20} color={themeColors.textColor2} weight="regular" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {displayAttachments.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>
                  {t('attachments.title', lang).toUpperCase()}
                </Text>
                {displayAttachments.map((attachment) => (
                  <TouchableOpacity
                    key={attachment.id}
                    style={[styles.rowCard, { backgroundColor: themeColors.backgroundColor2 }]}
                    onPress={() => handleAttachmentPress(attachment)}
                    activeOpacity={0.76}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: themeColors.backgroundColor3 }]}>
                      <Paperclip size={18} color={themeColors.accentColor} weight="bold" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowTitle, { color: themeColors.textColor }]} numberOfLines={1}>
                        {attachment.name || t('attachments.file', lang)}
                      </Text>
                      <Text style={[styles.rowSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
                        {formatFileSize(attachment.size)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleAttachmentPress(attachment, true);
                      }}
                      style={styles.rowActionButton}
                      accessibilityLabel={t('attachments.download', lang)}
                    >
                      <DownloadSimple size={20} color={themeColors.textColor2} weight="bold" />
                    </TouchableOpacity>
                    {Platform.OS === "android" && (
                      <TouchableOpacity
                        onPress={(event) => {
                          event?.stopPropagation?.();
                          handleAttachmentShare(attachment);
                        }}
                        style={styles.rowActionButton}
                        accessibilityLabel={getAttachmentShareLabel(lang)}
                      >
                        <ShareNetwork size={20} color={themeColors.textColor2} weight="bold" />
                      </TouchableOpacity>
                    )}
                    <ArrowUpRight size={20} color={themeColors.textColor2} weight="regular" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {visibleRelatedTasks.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>
                  {t('schedule.lesson_viewer.related_tasks', lang)}
                </Text>
                {visibleRelatedTasks.map((task, index) => (
                  <View
                    key={task?.id || index}
                    style={[styles.rowCard, { backgroundColor: themeColors.backgroundColor2 }]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: themeColors.backgroundColor3 }]}>
                      <CheckSquare
                        size={18}
                        color={task?.completed ? themeColors.accentColor : themeColors.textColor}
                        weight={task?.completed ? "fill" : "regular"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.rowTitle,
                          {
                            color: themeColors.textColor,
                            textDecorationLine: task?.completed ? "line-through" : "none",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {task?.text || t('tasks.empty_text', lang)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

          </SheetScrollView>

          <View
            style={[
              styles.footer,
              {
                backgroundColor: themeColors.backgroundColor,
                borderTopColor: themeColors.borderColor,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            {!!onAddTask && (
              <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton, styles.addTaskButton, { backgroundColor: themeColors.accentColor }]}
                  onPress={() => {
                    triggerHaptic("success");
                    onAddTask(lesson);
                  }}
              >
                  <Plus size={20} color="#fff" style={{marginRight: 8}} weight="bold" />
                  <Text style={[styles.actionButtonText, { color: '#fff' }]} numberOfLines={1}>
                    {t('schedule.lesson_viewer.add_task', lang)}
                  </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
                style={[
                  styles.actionButton,
                  onAddTask ? styles.secondaryActionButton : null,
                  { backgroundColor: 'rgba(255, 68, 68, 0.1)' },
                ]}
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete', lang)}
            >
                <Trash size={20} color="#ff4444" style={onAddTask ? null : {marginRight: 8}} weight="bold" />
                {!onAddTask && (
                  <Text style={[styles.actionButtonText, { color: '#ff4444' }]}>{t('common.delete', lang)}</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity 
                style={[
                  styles.actionButton,
                  onAddTask ? styles.secondaryActionButton : styles.primaryButton,
                  {
                    backgroundColor: onAddTask ? themeColors.backgroundColor2 : themeColors.accentColor,
                    borderColor: onAddTask ? themeColors.borderColor : "transparent",
                  },
                ]}
                onPress={() => {
                    triggerHaptic("open");
                    onClose();
                    onEdit({ ...lesson, subject: fullSubject, data: instanceData });
                }}
                accessibilityRole="button"
                accessibilityLabel={t('common.edit', lang)}
            >
                <PencilSimple
                  size={20}
                  color={onAddTask ? themeColors.accentColor : "#fff"}
                  style={onAddTask ? null : {marginRight: 8}}
                  weight="bold"
                />
                {!onAddTask && (
                  <Text style={[styles.actionButtonText, { color: '#fff' }]}>{t('common.edit', lang)}</Text>
                )}
            </TouchableOpacity>
          </View>

    </BottomSheet>
    <AttachmentImagePreview
      visible={!!previewAttachment}
      attachment={previewAttachment}
      attachments={displayAttachments}
      onClose={() => setPreviewAttachment(null)}
      themeColors={themeColors}
      lang={lang}
    />
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 100,
    position: 'relative',
    justifyContent: 'flex-end',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    position: 'absolute',
    bottom: -25,
    left: 20,
    right: 20,
    zIndex: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4,
  },
  closeBtn: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 8,
    borderRadius: 20,
    marginBottom: 35,
  },
  contentScroll: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  titleSection: {
    marginBottom: 20,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subjectName: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 32,
  },
  subjectFullName: {
    fontSize: 15,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    width: '100%',
    marginBottom: 20,
    opacity: 0.5,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  gridItem: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gridTextContainer: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1,
    marginLeft: 4,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  rowActionButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: 'row',
    marginTop: 'auto',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  addTaskButton: {
    flex: 1.65,
    minWidth: 0,
  },
  secondaryActionButton: {
    flex: 0,
    width: 50,
    paddingHorizontal: 0,
  },
  primaryButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
