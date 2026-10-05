import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
  useWindowDimensions,
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
import { buildScheduleSlots, getLessonSlotNumber, calculateScheduleWeek, getScheduleDayIndex } from "../../../utils/scheduleTime";
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
import { colorWithAlpha, getReadableForeground } from "../../../utils/gradientColors";
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
  const { height } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);

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

  const displayType = String(instanceData.type ?? fullSubject.type ?? "").trim();

  const displayRoom = String(instanceData.room ?? fullSubject.room ?? "").trim();
  const displayBuilding = String(instanceData.building ?? fullSubject.building ?? "").trim();
  const location = [displayBuilding, displayRoom].filter(Boolean).join(", ");
  const slotNumber = getLessonSlotNumber(instanceData, lesson.timeInfo, buildScheduleSlots(viewerSchedule?.start_time || "08:30", Number(viewerSchedule?.duration) || 45, viewerSchedule?.breaks || []));
  const time = [slotNumber ? t('schedule.lesson_editor.slot_number', lang, { number: slotNumber }) : null,
    [lesson.timeInfo?.start, lesson.timeInfo?.end].filter(Boolean).join(" – "),
  ].filter(Boolean).join(' · ');

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

  const headerForeground = getReadableForeground(headerGradient || headerColor);
  const actionForeground = getReadableForeground(themeColors.accentColor);
  const headerControlColor = colorWithAlpha(headerForeground, 0.14);
  const hasPrimaryAction = !!(onAddTask || onGoToLesson);
  const hasFooter = hasPrimaryAction || !readOnly;
  const maxSheetHeight = Math.max(240, Math.min(height * 0.85, height - insets.top - 20));
  const measuredHeight = 44 + headerHeight + contentHeight + (hasFooter ? footerHeight : 0);
  const sheetHeight = headerHeight && contentHeight && (!hasFooter || footerHeight)
    ? Math.min(maxSheetHeight, Math.max(240, measuredHeight))
    : Math.min(maxSheetHeight, height * 0.72);

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
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={[sheetHeight]}
      initialSnapIndex={0}
      maxWidth={640}
      backgroundColor={themeColors.backgroundColor}
      handleColor={headerForeground}
      headerBackground={(
        <GradientBackground
          gradient={headerGradient}
          fallbackColor={headerColor}
          style={StyleSheet.absoluteFill}
        />
      )}
      header={(
        <View
          style={styles.headerContent}
          onLayout={(event) => setHeaderHeight(Math.ceil(event.nativeEvent.layout.height))}
        >
          {MainIcon && (
            <View style={[styles.subjectIcon, { backgroundColor: headerControlColor }]}>
              <MainIcon size={26} color={headerForeground} weight="regular" />
            </View>
          )}
          <View style={styles.headerTitle}>
            {!!displayType && (
              <Text style={[styles.typeText, { color: headerForeground }]}>{displayType}</Text>
            )}
            <Text
              accessibilityRole="header"
              style={[styles.subjectName, { color: headerForeground }]}
              numberOfLines={3}
            >
              {fullSubject.name || t('common.untitled', lang)}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.close', lang)}
            style={[styles.closeBtn, { backgroundColor: headerControlColor }]}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={22} color={headerForeground} weight="bold" />
          </TouchableOpacity>
        </View>
      )}
      accessibilityLabel={fullSubject.name || t('common.untitled', lang)}
      closeAccessibilityLabel={t('common.close', lang)}
      testID="lesson-viewer-sheet"
    >
          <SheetScrollView
            style={styles.contentScroll}
            contentContainerStyle={[
              styles.scrollContent,
              !hasFooter && { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
            onContentSizeChange={(_, nextHeight) => setContentHeight(Math.ceil(nextHeight))}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!!fullSubject.fullName && fullSubject.fullName !== fullSubject.name && (
              <Text style={[styles.subjectFullName, { color: themeColors.textColor2 }]}>
                {fullSubject.fullName}
              </Text>
            )}
            {!!(time || location) && (
              <View style={[styles.details, { borderBottomColor: themeColors.borderColor }]}>
                {!!time && (
                  <View style={styles.detailRow}>
                    <Clock size={19} color={themeColors.textColor2} />
                    <Text
                      accessibilityLabel={`${t('schedule.lesson_viewer.time', lang)}: ${time}`}
                      style={[styles.detailText, { color: themeColors.textColor }]}
                    >
                      {time}
                    </Text>
                  </View>
                )}
                {!!location && (
                  <View style={styles.detailRow}>
                    <MapPin size={19} color={themeColors.textColor2} />
                    <Text
                      accessibilityLabel={`${t('common.room', lang)}: ${location}`}
                      style={[styles.detailText, { color: themeColors.textColor }]}
                    >
                      {location}
                    </Text>
                  </View>
                )}
              </View>
            )}

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
                      key={link.id || index}
                      accessibilityRole="link"
                      accessibilityLabel={`${link.name || t('common.link', lang)} ${openUrl}`}
                      style={[styles.rowCard, { backgroundColor: themeColors.backgroundColor2 }]}
                      onPress={() => handleLinkPress(openUrl)}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: color + "18" }]}>
                        <Icon size={18} color={color} weight="bold" />
                      </View>
                      <View style={styles.rowContent}>
                        <Text style={[styles.rowTitle, { color: themeColors.textColor }]}>
                          {link.name || t('common.link', lang)}
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
                  {t('attachments.title', lang)}
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

          {hasFooter && (
          <View
            onLayout={(event) => setFooterHeight(Math.ceil(event.nativeEvent.layout.height))}
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
                  accessibilityLabel={t('tasks.add_task', lang)}
                  style={[styles.actionButton, styles.addTaskButton, { backgroundColor: themeColors.accentColor }]}
                  onPress={() => {
                    triggerHaptic("success");
                    onAddTask(lesson);
                  }}
              >
                  <Plus size={20} color={actionForeground} style={{marginRight: 8}} weight="bold" />
                  <Text style={[styles.actionButtonText, { color: actionForeground }]}>
                    {t('tasks.add_task', lang)}
                  </Text>
              </TouchableOpacity>
            )}

            {!!onGoToLesson && (
              <TouchableOpacity
                  style={[styles.actionButton, styles.goToLessonButton, { backgroundColor: themeColors.accentColor }]}
                  onPress={() => {
                    triggerHaptic("open");
                    onGoToLesson(lesson);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('schedule.lesson_viewer.go_to_lesson', lang)}
              >
                  <CalendarDots size={20} color={actionForeground} style={{marginRight: 8}} weight="bold" />
                  <Text style={[styles.actionButtonText, { color: actionForeground }]}>
                    {t('schedule.lesson_viewer.go_to_lesson', lang)}
                  </Text>
              </TouchableOpacity>
            )}

            {!readOnly && (
            <TouchableOpacity
                style={[
                  styles.actionButton,
                  hasPrimaryAction ? styles.secondaryActionButton : null,
                  { backgroundColor: 'rgba(255, 68, 68, 0.1)' },
                ]}
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete', lang)}
            >
                <Trash size={20} color="#ff4444" style={hasPrimaryAction ? null : {marginRight: 8}} weight="bold" />
                {!hasPrimaryAction && (
                  <Text style={[styles.actionButtonText, { color: '#ff4444' }]}>{t('common.delete', lang)}</Text>
                )}
            </TouchableOpacity>
            )}

            {!readOnly && !!onEdit && (
            <TouchableOpacity
                style={[
                  styles.actionButton,
                  hasPrimaryAction ? styles.secondaryActionButton : null,
                  {
                    backgroundColor: hasPrimaryAction ? themeColors.backgroundColor2 : themeColors.accentColor,
                    borderColor: hasPrimaryAction ? themeColors.borderColor : "transparent",
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
                  color={hasPrimaryAction ? themeColors.accentColor : actionForeground}
                  style={hasPrimaryAction ? null : {marginRight: 8}}
                  weight="bold"
                />
                {!hasPrimaryAction && (
                  <Text style={[styles.actionButtonText, { color: actionForeground }]}>{t('common.edit', lang)}</Text>
                )}
            </TouchableOpacity>
            )}
          </View>
          )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  subjectIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, minWidth: 0, paddingTop: 2 },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  contentScroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 5,
  },
  subjectName: {
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 29,
  },
  subjectFullName: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 16,
  },
  details: {
    gap: 10,
    paddingBottom: 16,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 2,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
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
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  teacherCard: { alignItems: "center" },
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
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
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
  actionButtonText: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  }
});
