import React, { useRef } from "react";
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
  Link as LinkIcon,
  ArrowUpRight,
  DownloadSimple,
  CheckSquare,
  Plus,
  Paperclip,
  ShareNetwork,
  Trash,
  PencilSimple,
  CalendarDots
} from "phosphor-react-native";
import { useScheduleActions, useScheduleData } from "../../../context/ScheduleProvider";
import { useOptionalDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/ui/GradientBackground";
import { getIconComponent } from "../../../config/subjectIcons";
import {
  getContactIconComponent,
  getLinkIconComponent,
  getLinkTypeMeta,
  getTeacherContactTypeMeta,
} from "../../../config/contactTypes";
import { t } from "../../../utils/i18n";
import {
  getLinkOpenUrl,
  getTeacherAppearance,
  getTeacherContactOpenUrl,
  normalizeTeacherContacts,
} from "../../../utils/contactData";
import { calculateScheduleWeek, getScheduleDayIndex } from "../../../utils/scheduleTime";
import BottomSheet, { SheetScrollView } from "../../../components/ui/BottomSheet";
import { useAttachmentImagePreview } from "../../../context/AttachmentImagePreviewContext";
import { triggerHaptic } from "../../../utils/haptics";
import {
  deleteLocalAttachmentCaches,
  formatAttachmentError,
  formatFileSize,
  getAttachmentShareLabel,
  isImageAttachment,
  openAttachment,
  resolveAttachmentList,
  shareAttachment,
} from "../../../services/attachmentService";
import { deleteScheduleLesson } from "../../../utils/scheduleDeletion";

export default function LessonViewer({
  visible,
  lesson,
  relatedTasks = [],
  sourceSchedule = null,
  sourceDate = null,
  readOnly = false,
  onClose,
  onEdit,
  onAddTask,
  onGoToLesson,
}) {
  const { schedule, global, lang } = useScheduleData();
  const { setScheduleDraft } = useScheduleActions();
  const daySchedule = useOptionalDaySchedule();
  const insets = useSafeAreaInsets();
  const { openImagePreview } = useAttachmentImagePreview();
  const suppressedContactPressRef = useRef(null);

  if (!lesson) return null;

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const viewerSchedule = sourceSchedule || schedule;
  const currentDate = sourceDate || daySchedule?.currentDate || new Date();
  const getDayIndex = daySchedule?.getDayIndex || getScheduleDayIndex;
  const calculateCurrentWeek = daySchedule?.calculateCurrentWeek || ((targetDate) => (
    calculateScheduleWeek(viewerSchedule, targetDate)
  ));
  const subjects = Array.isArray(viewerSchedule?.subjects) ? viewerSchedule.subjects : [];
  const teachers = Array.isArray(viewerSchedule?.teachers) ? viewerSchedule.teachers : [];
  const links = Array.isArray(viewerSchedule?.links) ? viewerSchedule.links : [];
  const gradients = Array.isArray(viewerSchedule?.gradients) ? viewerSchedule.gradients : [];

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
  const headerGradient = fullSubject.typeColor === "gradient" && fullSubject.colorGradient
    ? gradients.find((gradient) => gradient.id === fullSubject.colorGradient) || null
    : null;
  const headerColor = themes.accentColors[fullSubject.color]
    || fullSubject.color
    || themeColors.accentColor;

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

  const getContactInteractionKey = (teacher, contact) => (
    `${teacher?.id || ""}:${contact?.id || `${contact?.type || ""}:${contact?.value || ""}`}`
  );

  const handleContactPress = async (teacher, contact) => {
    const interactionKey = getContactInteractionKey(teacher, contact);
    if (suppressedContactPressRef.current === interactionKey) {
      suppressedContactPressRef.current = null;
      return;
    }
    const url = getTeacherContactOpenUrl(contact);
    if (!url) return;
    await handleLinkPress(url);
  };

  const handleTeacherEdit = (teacher, contact = null, suppressNextOpen = false) => {
    if (readOnly || !onEdit) return;
    if (contact && suppressNextOpen) {
      const interactionKey = getContactInteractionKey(teacher, contact);
      suppressedContactPressRef.current = interactionKey;
      setTimeout(() => {
        if (suppressedContactPressRef.current === interactionKey) {
          suppressedContactPressRef.current = null;
        }
      }, 800);
    }
    triggerHaptic("open");
    onClose?.();
    onEdit(
      { ...lesson, subject: fullSubject, data: instanceData },
      {
        type: "teacher",
        teacherId: teacher.id,
        contactId: contact?.id || null,
        contact: contact ? { type: contact.type, value: contact.value } : null,
      },
    );
  };

  const handleAttachmentPress = async (attachment, download = false) => {
    try {
      triggerHaptic("open");
      if (!download && isImageAttachment(attachment)) {
        openImagePreview({
          attachment,
          attachments: displayAttachments,
          themeColors,
          lang,
        });
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

  const deleteLessonWithScope = (scope) => {
    const recurrenceWeeks = Array.isArray(instanceData.recurrence?.weeks)
      ? instanceData.recurrence.weeks
      : [];
    const keepsOtherOccurrences = (
      scope === "occurrence"
      && !!instanceData.recurrence?.id
      && recurrenceWeeks.length > 1
    );
    triggerHaptic("success");
    setScheduleDraft((prev) => {
      const dayIndex = getDayIndex(currentDate);
      const weekKey = `week${calculateCurrentWeek(currentDate)}`;
      return deleteScheduleLesson(prev, dayIndex, weekKey, lesson.index, scope);
    });
    if (!keepsOtherOccurrences) {
      deleteLocalAttachmentCaches(instanceData.attachments).catch(() => {});
    }
    onClose();
  };

  const handleDelete = () => {
    triggerHaptic("warning");
    const recurrenceWeeks = Array.isArray(instanceData.recurrence?.weeks)
      ? instanceData.recurrence.weeks
      : [];
    const isRepeating = !!instanceData.recurrence?.id && recurrenceWeeks.length > 1;

    Alert.alert(
      t('common.warning', lang),
      isRepeating
        ? t('schedule.lesson_editor.delete_series_confirm', lang)
        : t('schedule.lesson_editor.delete_lesson_confirm', lang),
      isRepeating
        ? [
          { text: t('common.cancel', lang), style: 'cancel' },
          {
            text: t('schedule.lesson_editor.delete_occurrence', lang),
            onPress: () => deleteLessonWithScope("occurrence"),
          },
          {
            text: t('schedule.lesson_editor.delete_series', lang),
            style: 'destructive',
            onPress: () => deleteLessonWithScope("series"),
          },
        ]
        : [
          { text: t('common.cancel', lang), style: 'cancel' },
          {
            text: t('common.delete', lang),
            style: 'destructive',
            onPress: () => deleteLessonWithScope("occurrence"),
          },
        ],
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
          <GradientBackground
            gradient={headerGradient}
            fallbackColor={headerColor}
            style={styles.headerContainer}
          >
            <View style={styles.headerContent}>
              {MainIcon ? (
                <View style={styles.iconCircle}>
                   <MainIcon size={32} color={themeColors.backgroundColor} weight="fill" />
                </View>
              ) : (
                <View />
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('common.close', lang)}
                style={styles.closeBtn}
                onPress={handleClose}
              >
                <X size={24} color="#fff" weight="bold" />
              </TouchableOpacity>
            </View>
          </GradientBackground>

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
                {displayTeachers.map((teacher, index) => {
                  const contacts = normalizeTeacherContacts(teacher, () => "");
                  const appearance = getTeacherAppearance(teacher);
                  const TeacherIcon = getContactIconComponent(appearance.icon, "user") || User;

                  return (
                    <View key={teacher.id || index} style={[styles.rowCard, styles.teacherCard, { backgroundColor: themeColors.backgroundColor2 }]}>
                      <View style={[styles.rowIcon, { backgroundColor: appearance.color + "18", borderColor: themeColors.borderColor, borderWidth: StyleSheet.hairlineWidth }]}>
                        <TeacherIcon size={18} color={appearance.color} weight="bold" />
                      </View>
                      <View style={styles.rowContent}>
                        <Text style={[styles.rowTitle, { color: themeColors.textColor }]}>{teacher.name}</Text>
                        {contacts.length > 0 && (
                          <View style={styles.contactChipWrap}>
                            {contacts.map((contact) => {
                              const meta = getTeacherContactTypeMeta(contact.type);
                              const Icon = getContactIconComponent(contact.icon, contact.type);
                              const label = contact.label || contact.value;
                              const contactKey = contact.id || `${contact.type}-${contact.value}`;
                              return (
                                <View
                                  key={contactKey}
                                  style={[styles.contactChip, { backgroundColor: (contact.color || meta.color) + "14", borderColor: (contact.color || meta.color) + "55" }]}
                                >
                                  <TouchableOpacity
                                    accessibilityRole="link"
                                    accessibilityLabel={label}
                                    accessibilityHint={!readOnly && onEdit ? t("schedule.lesson_viewer.contact_long_press_hint", lang) : undefined}
                                    onPress={() => handleContactPress(teacher, contact)}
                                    onLongPress={!readOnly && onEdit ? () => handleTeacherEdit(teacher, contact, true) : undefined}
                                    delayLongPress={350}
                                    style={styles.contactOpenButton}
                                  >
                                    <Icon size={14} color={contact.color || meta.color} weight="bold" />
                                    <Text style={[styles.contactChipText, { color: themeColors.textColor }]} numberOfLines={1}>
                                      {label}
                                    </Text>
                                  </TouchableOpacity>
                                  {!readOnly && onEdit ? (
                                    <TouchableOpacity
                                      style={[styles.contactEditButton, { borderLeftColor: (contact.color || meta.color) + "55" }]}
                                      onPress={() => handleTeacherEdit(teacher, contact)}
                                      accessibilityRole="button"
                                      accessibilityLabel={`${t("common.edit", lang)}: ${label}`}
                                    >
                                      <PencilSimple size={15} color={contact.color || meta.color} weight="bold" />
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                      {!readOnly && onEdit ? (
                        <TouchableOpacity
                          style={styles.rowActionButton}
                          onPress={() => handleTeacherEdit(teacher)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t("common.edit", lang)}: ${teacher.name}`}
                        >
                          <PencilSimple size={19} color={themeColors.accentColor} weight="bold" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {displayLinks.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>
                  {t('schedule.lesson_viewer.materials', lang)}
                </Text>
                {displayLinks.map((link, index) => {
                  const meta = getLinkTypeMeta(link.type, link.url);
                  const Icon = getLinkIconComponent(link) || LinkIcon;
                  const color = link.color || meta.color;
                  const openUrl = getLinkOpenUrl(link);
                  return (
                    <TouchableOpacity
                      key={index}
                      accessibilityRole="link"
                      accessibilityLabel={`${link.name || t('schedule.lesson_viewer.default_link', lang)} ${openUrl}`}
                      style={[styles.rowCard, { backgroundColor: themeColors.backgroundColor2 }]}
                      onPress={() => handleLinkPress(openUrl)}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: color + "18" }]}>
                        <Icon size={18} color={color} weight="bold" />
                      </View>
                      <View style={styles.rowContent}>
                        <Text style={[styles.rowTitle, { color, textDecorationLine: 'underline' }]}>
                          {link.name || t('schedule.lesson_viewer.default_link', lang)}
                        </Text>
                        <Text style={[styles.rowSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
                          {t(meta.labelKey, lang)} · {link.url}
                        </Text>
                      </View>
                      <ArrowUpRight size={20} color={themeColors.textColor2} weight="regular" />
                    </TouchableOpacity>
                  );
                })}
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
                    accessibilityRole="button"
                    accessibilityLabel={`${attachment.name || t('attachments.file', lang)} ${formatFileSize(attachment.size)}`}
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
                      accessibilityRole="button"
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
                        accessibilityRole="button"
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
                  accessibilityRole="button"
                  accessibilityLabel={t('schedule.lesson_viewer.add_task', lang)}
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

            {!!onGoToLesson && (
              <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton, styles.goToLessonButton, { backgroundColor: themeColors.accentColor }]}
                  onPress={() => {
                    triggerHaptic("open");
                    onGoToLesson(lesson);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('schedule.lesson_viewer.go_to_lesson', lang)}
              >
                  <CalendarDots size={20} color="#fff" style={{marginRight: 8}} weight="bold" />
                  <Text style={[styles.actionButtonText, { color: '#fff' }]} numberOfLines={1}>
                    {t('schedule.lesson_viewer.go_to_lesson', lang)}
                  </Text>
              </TouchableOpacity>
            )}

            {!readOnly && (
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
            )}

            {!readOnly && !!onEdit && (
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
            )}
          </View>

    </BottomSheet>
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  rowContent: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  teacherCard: { alignItems: "flex-start" },
  contactChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  contactChip: { maxWidth: "100%", minHeight: 44, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },
  contactOpenButton: { minHeight: 44, minWidth: 0, flexShrink: 1, paddingLeft: 11, paddingRight: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  contactEditButton: { width: 44, minHeight: 44, borderLeftWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  contactChipText: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  rowActionButton: {
    width: 44,
    height: 44,
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
  goToLessonButton: {
    flex: 1.65,
    minWidth: 0,
  },
  secondaryActionButton: {
    flex: 0,
    width: 52,
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
