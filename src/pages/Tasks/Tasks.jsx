import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDots,
  CaretDown,
  CheckSquare,
  ClipboardText,
  Link as LinkIcon,
  Plus,
  Square,
} from "phosphor-react-native";
import tinycolor from "tinycolor2";

import AppBlur from "../../components/ui/AppBlur";
import GradientBackground from "../../components/ui/GradientBackground";
import { useScheduleActions, useScheduleData, useScheduleLayout } from "../../context/ScheduleProvider";
import themes from "../../config/themes";
import { getIconComponent } from "../../config/subjectIcons";
import { t } from "../../utils/i18n";
import { resolveScheduleColor, scheduleColorWithAlpha } from "../../utils/scheduleColors";
import {
  APP_HEADER_BODY_HEIGHT,
  APP_HEADER_CONTENT_GAP,
  getAppHeaderHeight,
  getAppHeaderTopInset,
} from "../../config/layoutMetrics";
import TaskEditor from "./components/TaskEditor";
import TaskScheduleFilterSheet from "./components/TaskScheduleFilterSheet";

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const TASK_ICON_CELL_SIZE = 46;
const TASK_ICON_SIZE = 22;
const TASK_ICON_PATTERN_MIN_HEIGHT = 132;
const TASKS_TITLE_LINE_HEIGHT = 38;
const TASKS_SUBTITLE_LINE_HEIGHT = 18;
const TASKS_HEADER_TOP_PADDING = 14;
const TASKS_HEADER_BOTTOM_PADDING = APP_HEADER_BODY_HEIGHT
  - TASKS_HEADER_TOP_PADDING
  - TASKS_TITLE_LINE_HEIGHT
  - 4
  - TASKS_SUBTITLE_LINE_HEIGHT;
const TASK_CARD_GAP = 8;
const TASK_CARD_EXPANDED_MIN_HEIGHT = 104;
const TASK_CARD_COLLAPSED_MIN_HEIGHT = 56;
const TASK_CARD_EXPANDED_PADDING_VERTICAL = 12;
const TASK_CARD_COLLAPSED_PADDING_VERTICAL = 10;
const TASK_DETAILS_TOP_GAP = 8;
const taskIconPatternCache = {};

const getTaskIconPatternPositions = (width, height) => {
  const key = `${width}_${height}`;
  if (taskIconPatternCache[key]) return taskIconPatternCache[key];

  const positions = [];
  const startX = (width % TASK_ICON_CELL_SIZE) / 2 - TASK_ICON_CELL_SIZE;
  const startY = (height % TASK_ICON_CELL_SIZE) / 2 - TASK_ICON_CELL_SIZE;

  let row = 0;
  for (let y = startY; y < height; y += TASK_ICON_CELL_SIZE) {
    let column = 0;
    for (let x = startX; x < width; x += TASK_ICON_CELL_SIZE) {
      if ((row + column) % 2 === 0) {
        const top = y + (TASK_ICON_CELL_SIZE - TASK_ICON_SIZE) / 2;
        const left = x + (TASK_ICON_CELL_SIZE - TASK_ICON_SIZE) / 2;

        if (
          left + TASK_ICON_SIZE > 0
          && left < width
          && top + TASK_ICON_SIZE > 0
          && top < height
        ) {
          positions.push({ top, left, key: `${row}-${column}` });
        }
      }
      column += 1;
    }
    row += 1;
  }

  taskIconPatternCache[key] = positions;
  return positions;
};

const uniqueIds = (value) => (
  Array.isArray(value)
    ? [...new Set(value.filter(Boolean))]
    : []
);

const areSameIds = (left, right) => (
  left.length === right.length && left.every((id, index) => id === right[index])
);

const parseTaskTimestamp = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const sortTaskEntriesNewestFirst = (left, right) => (
  parseTaskTimestamp(right?.task?.createdAt) - parseTaskTimestamp(left?.task?.createdAt)
);

const normalizeSelectedScheduleIds = (value, schedules, fallbackScheduleId) => {
  const validIds = new Set((Array.isArray(schedules) ? schedules : []).map((item) => item?.id).filter(Boolean));
  const nextIds = uniqueIds(value).filter((id) => validIds.has(id));

  if (nextIds.length > 0) return nextIds;
  if (fallbackScheduleId && validIds.has(fallbackScheduleId)) return [fallbackScheduleId];

  const firstSchedule = (Array.isArray(schedules) ? schedules : []).find((item) => item?.id);
  return firstSchedule?.id ? [firstSchedule.id] : [];
};

const getGradientColors = (gradient) => (
  Array.isArray(gradient?.colors)
    ? gradient.colors
      .map((colorStop) => (typeof colorStop === "string" ? colorStop : colorStop?.color))
      .filter((color) => typeof color === "string" && tinycolor(color).isValid())
    : []
);

const getGradientColor = (gradient) => getGradientColors(gradient)[0] || null;

const getReadableTextColor = (backgroundColor, fallback = "#fff") => {
  const parsed = tinycolor(backgroundColor);
  if (!parsed.isValid()) return fallback;
  return parsed.isLight() ? "#111827" : "#fff";
};

const getTaskTextColor = (backgroundColor, gradient, fallback) => {
  const gradientColors = getGradientColors(gradient);
  if (gradientColors.length === 0) return getReadableTextColor(backgroundColor, fallback);

  const parsedColors = gradientColors.map((color) => tinycolor(color)).filter((color) => color.isValid());

  if (parsedColors.length === 0) return fallback;

  const isNeutralLightGradient = parsedColors.every((color) => (
    color.isLight() && color.getBrightness() >= 205 && color.toHsl().s < 0.18
  ));

  if (isNeutralLightGradient) return "#111827";

  return "#fff";
};

const withAlpha = (color, alpha) => tinycolor(color).setAlpha(alpha).toRgbString();

const formatTaskDate = (value, lang) => {
  const timestamp = parseTaskTimestamp(value);
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleDateString(lang === "uk" ? "uk-UA" : "en-US", {
    day: "numeric",
    month: "short",
  });
};

function EmptyState({ icon: Icon = ClipboardText, title, description, themeColors, topInset }) {
  return (
    <View style={[styles.emptyContainer, { paddingTop: topInset }]}>
      <View style={[styles.emptyIcon, { backgroundColor: themeColors.accentColor + "18" }]}>
        <Icon size={34} color={themeColors.accentColor} weight="duotone" />
      </View>
      <Text style={[styles.emptyTitle, { color: themeColors.textColor }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: themeColors.textColor2 }]}>{description}</Text>
    </View>
  );
}

const TaskIconPattern = React.memo(({ Icon, color, opacity, collapseProgress }) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const previousIconRef = useRef(null);

  const positions = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return [];
    return getTaskIconPatternPositions(dimensions.width, dimensions.height);
  }, [dimensions.height, dimensions.width]);

  useEffect(() => {
    if (!Icon) return;

    if (previousIconRef.current !== Icon) {
      fadeAnim.setValue(0);
      previousIconRef.current = Icon;
    }

    Animated.timing(fadeAnim, {
      toValue: opacity,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [Icon, fadeAnim, opacity]);

  const handleLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions((previous) => {
      const nextWidth = Math.round(width);
      const nextHeight = Math.max(
        previous.height,
        TASK_ICON_PATTERN_MIN_HEIGHT,
        Math.round(height),
      );

      if (Math.abs(previous.width - nextWidth) < 2 && previous.height === nextHeight) {
        return previous;
      }

      return { width: nextWidth, height: nextHeight };
    });
  }, []);

  if (!Icon) return null;

  const motionStyle = collapseProgress
    ? {
      transform: [
        {
          translateY: collapseProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -8],
          }),
        },
        {
          scale: collapseProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.96],
          }),
        },
      ],
    }
    : null;

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={handleLayout}
      style={[
        StyleSheet.absoluteFillObject,
        styles.cardIconPattern,
        { opacity: fadeAnim },
        motionStyle,
      ]}
    >
      {positions.map((position) => (
        <View
          key={position.key}
          style={[
            styles.cardIconPatternItem,
            {
              top: position.top,
              left: position.left,
            },
          ]}
        >
          <Icon
            size={TASK_ICON_SIZE}
            color={color}
            weight="regular"
            style={Platform.OS === "web" ? { overflow: "visible" } : undefined}
          />
        </View>
      ))}
    </Animated.View>
  );
});

function TaskCard({ entry, themeColors, themeMode, lang, showScheduleName, onPress, onToggle }) {
  const { task, subject, links, scheduleName, scheduleColor, activeGradient } = entry;
  const completed = task?.completed === true;
  const collapseProgress = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const createdLabel = formatTaskDate(task?.createdAt, lang);
  const subjectColor = themes.accentColors[subject?.color] || subject?.color;
  const cardColor = activeGradient
    ? getGradientColor(activeGradient) || subjectColor || scheduleColor || themeColors.accentColor
    : subjectColor || scheduleColor || themeColors.backgroundColor2;
  const isDarkTheme = themeMode === "dark" || themeMode === "oled";
  const textOnCard = getTaskTextColor(cardColor, activeGradient, isDarkTheme ? "#fff" : "#111827");
  const mutedTextOnCard = withAlpha(textOnCard, 0.82);
  const chipBackground = withAlpha(textOnCard, textOnCard === "#fff" ? 0.17 : 0.13);
  const usesLightText = textOnCard === "#fff";
  const shadeColors = usesLightText
    ? ["rgba(0,0,0,0.26)", "rgba(0,0,0,0.14)", "rgba(0,0,0,0.34)"]
    : ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)", "rgba(0,0,0,0.08)"];
  const completedShadeColors = usesLightText
    ? ["rgba(0,0,0,0.30)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.38)"]
    : ["rgba(255,255,255,0.05)", "rgba(0,0,0,0.02)", "rgba(0,0,0,0.12)"];
  const borderColor = textOnCard === "#fff"
    ? (completed ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.24)")
    : (completed ? "rgba(17,24,39,0.26)" : "rgba(17,24,39,0.18)");
  const titleLabel = subject?.name || t("tasks.no_subject", lang);
  const SubjectIcon = getIconComponent(subject?.icon);
  const iconPatternOpacity = usesLightText ? 0.18 : 0.07;
  const animatedCardStyle = {
    minHeight: collapseProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [TASK_CARD_EXPANDED_MIN_HEIGHT, TASK_CARD_COLLAPSED_MIN_HEIGHT],
    }),
    paddingTop: collapseProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [TASK_CARD_EXPANDED_PADDING_VERTICAL, TASK_CARD_COLLAPSED_PADDING_VERTICAL],
    }),
    paddingBottom: collapseProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [TASK_CARD_EXPANDED_PADDING_VERTICAL, TASK_CARD_COLLAPSED_PADDING_VERTICAL],
    }),
    opacity: collapseProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1],
    }),
  };
  const detailsStyle = {
    opacity: collapseProgress.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [1, 0, 0],
    }),
    maxHeight: collapseProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [220, 0],
    }),
    marginTop: collapseProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [TASK_DETAILS_TOP_GAP, 0],
    }),
  };
  const uncheckedIconStyle = {
    opacity: collapseProgress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0, 0],
    }),
    transform: [
      {
        scale: collapseProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.86],
        }),
      },
    ],
  };
  const checkedIconStyle = {
    opacity: collapseProgress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 1, 1],
    }),
    transform: [
      {
        scale: collapseProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.86, 1],
        }),
      },
    ],
  };

  useEffect(() => {
    Animated.timing(collapseProgress, {
      toValue: completed ? 1 : 0,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [collapseProgress, completed]);

  const handleLinkPress = async (link) => {
    if (!link?.url) return;
    try {
      const supported = await Linking.canOpenURL(link.url);
      if (supported) {
        await Linking.openURL(link.url);
      } else {
        Alert.alert(t("common.error", lang), t("tasks.errors.link_open_failed", lang));
      }
    } catch (error) {
      console.warn("Could not open task link", error);
      Alert.alert(t("common.error", lang), t("tasks.errors.link_open_failed", lang));
    }
  };

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[
        styles.card,
        animatedCardStyle,
        {
          backgroundColor: cardColor,
        },
      ]}
    >
      {activeGradient && (
        <GradientBackground gradient={activeGradient} style={StyleSheet.absoluteFillObject} />
      )}
      <TaskIconPattern
        Icon={SubjectIcon}
        color={textOnCard}
        opacity={iconPatternOpacity}
        collapseProgress={collapseProgress}
      />
      <LinearGradient
        pointerEvents="none"
        colors={completed ? completedShadeColors : shadeColors}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[styles.cardHighlight, { borderColor }]}
      />

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        hitSlop={10}
        style={styles.checkboxButton}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
      >
        <View style={styles.checkboxIconSlot}>
          <Animated.View style={[styles.checkboxIconLayer, uncheckedIconStyle]}>
            <Square size={30} color={mutedTextOnCard} weight="regular" />
          </Animated.View>
          <Animated.View style={[styles.checkboxIconLayer, checkedIconStyle]}>
            <CheckSquare size={30} color={textOnCard} weight="fill" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          {showScheduleName && (
            <View style={[styles.schedulePill, { backgroundColor: chipBackground }]}>
              <View style={[styles.scheduleDot, { backgroundColor: scheduleColor }]} />
              <Text style={[styles.scheduleName, { color: textOnCard }]} numberOfLines={1}>
                {scheduleName}
              </Text>
            </View>
          )}

          <Text
            style={[
              styles.subjectName,
              { color: textOnCard },
              showScheduleName ? styles.subjectNameWithSchedule : styles.subjectNameSingle,
            ]}
            numberOfLines={1}
          >
            {titleLabel}
          </Text>

          {!!createdLabel && (
            <Text
              style={[
                styles.createdAt,
                { color: mutedTextOnCard },
              ]}
            >
              {createdLabel}
            </Text>
          )}
        </View>

        <Animated.View style={[styles.cardDetails, detailsStyle]} pointerEvents={completed ? "none" : "auto"}>
          <Text
            style={[
              styles.taskText,
              { color: textOnCard },
            ]}
          >
            {task?.text || t("tasks.empty_text", lang)}
          </Text>

          {links.length > 0 && (
            <View style={styles.linksWrap}>
              {links.map((link) => (
                <TouchableOpacity
                  key={link.id}
                  activeOpacity={0.75}
                  onPress={() => handleLinkPress(link)}
                  style={[styles.linkChip, { backgroundColor: chipBackground }]}
                >
                  <LinkIcon size={14} color={textOnCard} weight="bold" />
                  <Text style={[styles.linkText, { color: textOnCard }]} numberOfLines={1}>
                    {link.name || t("tasks.default_link", lang)}
                  </Text>
                  <ArrowUpRight size={13} color={mutedTextOnCard} weight="bold" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      </View>
    </AnimatedTouchableOpacity>
  );
}

export default function Tasks() {
  const { global, schedule, schedules, lang } = useScheduleData();
  const { setScheduleDraft, setData } = useScheduleActions();
  const { tabBarHeight } = useScheduleLayout();
  const insets = useSafeAreaInsets();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  const safeTabBarHeight = tabBarHeight || (110 + insets.bottom);
  const dynamicBottomOffset = safeTabBarHeight + 16;
  const activeScheduleId = global?.currentScheduleId || schedule?.id || null;
  const fallbackScheduleId = activeScheduleId || schedules?.[0]?.id || null;

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const headerTopInset = getAppHeaderTopInset(insets.top);
  const headerHeight = getAppHeaderHeight(insets.top);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);

  const scheduleById = useMemo(() => {
    const map = new Map();
    schedules.forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    return map;
  }, [schedules]);

  const normalizedSelectedScheduleIds = useMemo(() => (
    normalizeSelectedScheduleIds(selectedScheduleIds, schedules, fallbackScheduleId)
  ), [fallbackScheduleId, schedules, selectedScheduleIds]);

  useEffect(() => {
    setSelectedScheduleIds((previous) => {
      const next = normalizeSelectedScheduleIds(previous, schedules, fallbackScheduleId);
      return areSameIds(previous, next) ? previous : next;
    });
  }, [fallbackScheduleId, schedules]);

  const selectedSchedules = useMemo(() => (
    normalizedSelectedScheduleIds
      .map((id) => scheduleById.get(id))
      .filter(Boolean)
  ), [normalizedSelectedScheduleIds, scheduleById]);

  const singleSelectedSchedule = selectedSchedules.length === 1 ? selectedSchedules[0] : null;
  const newTaskSchedule = singleSelectedSchedule || schedule;
  const editorSourceSchedule = editingEntry
    ? scheduleById.get(editingEntry.scheduleId) || editingEntry.sourceSchedule
    : newTaskSchedule;

  const flatTasks = useMemo(() => {
    const untitledSchedule = t("settings.schedule_switcher.untitled", lang);

    return selectedSchedules
      .flatMap((sourceSchedule) => {
        const subjects = Array.isArray(sourceSchedule?.subjects) ? sourceSchedule.subjects : [];
        const links = Array.isArray(sourceSchedule?.links) ? sourceSchedule.links : [];
        const gradients = Array.isArray(sourceSchedule?.gradients) ? sourceSchedule.gradients : [];
        const tasks = Array.isArray(sourceSchedule?.tasks) ? sourceSchedule.tasks : [];
        const subjectById = new Map(subjects.map((subject) => [subject?.id, subject]).filter(([id]) => !!id));
        const linksById = new Map(links.map((link) => [link?.id, link]).filter(([id]) => !!id));
        const scheduleColor = resolveScheduleColor(sourceSchedule, themeColors.accentColor);
        const scheduleName = sourceSchedule?.name || untitledSchedule;

        return tasks.map((task) => {
          const subject = task?.subjectId ? subjectById.get(task.subjectId) : null;
          const activeGradient = subject?.typeColor === "gradient" && subject?.colorGradient
            ? gradients.find((gradient) => gradient?.id === subject.colorGradient) || null
            : null;

          return {
            task,
            scheduleId: sourceSchedule.id,
            scheduleName,
            scheduleColor,
            subject,
            links: uniqueIds(task?.links).map((id) => linksById.get(id)).filter(Boolean),
            sourceSchedule,
            activeGradient,
          };
        });
      })
      .sort(sortTaskEntriesNewestFirst);
  }, [lang, selectedSchedules, themeColors.accentColor]);

  const taskListVersion = useMemo(() => (
    flatTasks
      .map((entry) => [
        entry.scheduleId,
        entry.task?.id,
        entry.task?.updatedAt,
        entry.task?.completed === true ? 1 : 0,
        entry.task?.text,
        entry.task?.subjectId,
      ].join(":"))
      .join("|")
  ), [flatTasks]);

  const selectedCountLabel = useMemo(() => {
    if (singleSelectedSchedule) {
      return singleSelectedSchedule.name || t("settings.schedule_switcher.untitled", lang);
    }
    return t("tasks.filter.selected_count", lang).replace("{count}", String(normalizedSelectedScheduleIds.length));
  }, [lang, normalizedSelectedScheduleIds.length, singleSelectedSchedule]);

  const filterColor = singleSelectedSchedule
    ? resolveScheduleColor(singleSelectedSchedule, themeColors.accentColor)
    : themeColors.accentColor;

  const setSelectedSchedules = useCallback((nextIds) => {
    setSelectedScheduleIds(normalizeSelectedScheduleIds(nextIds, schedules, fallbackScheduleId));
  }, [fallbackScheduleId, schedules]);

  const updateScheduleById = useCallback((scheduleId, updater) => {
    if (!scheduleId) return;

    if (scheduleId === activeScheduleId) {
      setScheduleDraft((previousSchedule) => (
        typeof updater === "function" ? updater(previousSchedule) : updater
      ));
      return;
    }

    setData((previousData) => {
      if (!previousData) return previousData;

      let changed = false;
      const nextSchedules = (previousData.schedules || []).map((item) => {
        if (item?.id !== scheduleId) return item;

        const updatedSchedule = typeof updater === "function" ? updater(item) : updater;
        if (!updatedSchedule || updatedSchedule === item) return item;

        changed = true;
        return { ...updatedSchedule, lastModified: Date.now() };
      });

      return changed ? { ...previousData, schedules: nextSchedules } : previousData;
    });
  }, [activeScheduleId, setData, setScheduleDraft]);

  const openNewTask = useCallback(() => {
    setEditingEntry(null);
    setEditorVisible(true);
  }, []);

  const openTask = useCallback((entry) => {
    setEditingEntry(entry);
    setEditorVisible(true);
  }, []);

  const toggleCompleted = useCallback((entry) => {
    const now = Date.now();
    updateScheduleById(entry.scheduleId, (previousSchedule) => {
      const previousTasks = Array.isArray(previousSchedule?.tasks) ? previousSchedule.tasks : [];
      let changed = false;
      const nextTasks = previousTasks.map((task) => {
        if (task?.id !== entry.task?.id) return task;
        changed = true;
        return { ...task, completed: task.completed !== true, updatedAt: now };
      });

      return changed ? { ...previousSchedule, tasks: nextTasks } : previousSchedule;
    });
  }, [updateScheduleById]);

  const saveTask = useCallback(({ scheduleId, task: savedTask, links: nextLinks }) => {
    if (!scheduleId || !savedTask?.id) return;

    updateScheduleById(scheduleId, (previousSchedule) => {
      const previousTasks = Array.isArray(previousSchedule?.tasks) ? previousSchedule.tasks : [];
      const sanitizedTask = {
        ...savedTask,
        links: uniqueIds(savedTask.links),
      };
      const existingIndex = previousTasks.findIndex((item) => item?.id === sanitizedTask.id);
      const nextTasks = [...previousTasks];

      if (existingIndex >= 0) {
        nextTasks[existingIndex] = { ...nextTasks[existingIndex], ...sanitizedTask };
      } else {
        nextTasks.push(sanitizedTask);
      }

      return {
        ...previousSchedule,
        links: Array.isArray(nextLinks) ? nextLinks : previousSchedule?.links,
        tasks: nextTasks,
      };
    });
  }, [updateScheduleById]);

  const deleteTask = useCallback((scheduleId, taskId) => {
    if (!scheduleId || !taskId) return;

    updateScheduleById(scheduleId, (previousSchedule) => ({
      ...previousSchedule,
      tasks: (Array.isArray(previousSchedule?.tasks) ? previousSchedule.tasks : []).filter((item) => item?.id !== taskId),
    }));
  }, [updateScheduleById]);

  const renderTask = useCallback(({ item }) => (
    <TaskCard
      entry={item}
      themeColors={themeColors}
      themeMode={mode}
      lang={lang}
      showScheduleName={normalizedSelectedScheduleIds.length > 1}
      onPress={() => openTask(item)}
      onToggle={() => toggleCompleted(item)}
    />
  ), [lang, mode, normalizedSelectedScheduleIds.length, openTask, themeColors, toggleCompleted]);

  const renderContent = () => {
    if (!schedules.length) {
      return (
        <EmptyState
          icon={BookOpen}
          title={t("tasks.no_schedule_title", lang)}
          description={t("tasks.no_schedule_desc", lang)}
          themeColors={themeColors}
          topInset={headerHeight}
        />
      );
    }

    if (flatTasks.length === 0) {
      return (
        <EmptyState
          title={t("tasks.empty_title", lang)}
          description={t("tasks.empty_desc", lang)}
          themeColors={themeColors}
          topInset={headerHeight}
        />
      );
    }

    return (
      <FlatList
        data={flatTasks}
        extraData={`${taskListVersion}:${normalizedSelectedScheduleIds.join(",")}:${mode}:${accent}`}
        renderItem={renderTask}
        keyExtractor={(item, index) => `${item.scheduleId}:${item.task?.id || index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + APP_HEADER_CONTENT_GAP,
            paddingBottom: safeTabBarHeight + 96,
          },
        ]}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      <View style={[styles.headerContainer, { height: headerHeight, borderBottomColor: themeColors.borderColor }]}>
        <AppBlur style={StyleSheet.absoluteFill} intensity={50} />
        <View style={[styles.header, { paddingTop: headerTopInset + TASKS_HEADER_TOP_PADDING }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: themeColors.textColor }]}>
                {t("common.tasks", lang)}
              </Text>
              <Text style={[styles.subtitle, { color: themeColors.textColor2 }]}>
                {flatTasks.length > 0
                  ? t("tasks.count", lang).replace("{count}", String(flatTasks.length))
                  : t("tasks.subtitle", lang)}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => setFilterVisible(true)}
              style={[
                styles.filterButton,
                {
                  backgroundColor: themeColors.backgroundColor2,
                  borderColor: themeColors.borderColor,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("tasks.filter.title", lang)}
            >
              <View style={[styles.filterIcon, { backgroundColor: scheduleColorWithAlpha(filterColor, 0.16) }]}>
                <CalendarDots size={18} color={filterColor} weight="bold" />
              </View>
              <Text style={[styles.filterLabel, { color: themeColors.textColor }]} numberOfLines={1}>
                {selectedCountLabel}
              </Text>
              <CaretDown size={15} color={themeColors.textColor2} weight="bold" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      {!!newTaskSchedule && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: themeColors.accentColor, bottom: dynamicBottomOffset }]}
          onPress={openNewTask}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("tasks.add_task", lang)}
        >
          <Plus size={32} color="#fff" weight="bold" />
        </TouchableOpacity>
      )}

      {editorVisible && editorSourceSchedule && (
        <View style={[StyleSheet.absoluteFill, { bottom: safeTabBarHeight }]} pointerEvents="box-none">
          <TaskEditor
            task={editingEntry?.task || null}
            sourceSchedule={editorSourceSchedule}
            onSave={saveTask}
            onDelete={deleteTask}
            onClose={() => setEditorVisible(false)}
          />
        </View>
      )}

      <TaskScheduleFilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedIds={normalizedSelectedScheduleIds}
        onChange={setSelectedSchedules}
        activeScheduleId={activeScheduleId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: TASKS_HEADER_BOTTOM_PADDING,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 32,
    lineHeight: TASKS_TITLE_LINE_HEIGHT,
    fontWeight: "800",
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: TASKS_SUBTITLE_LINE_HEIGHT,
    marginTop: 4,
    fontWeight: "500",
  },
  filterButton: {
    minHeight: 44,
    maxWidth: 190,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 8,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  filterIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingTop: 4,
  },
  card: {
    flexDirection: "row",
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: TASK_CARD_GAP,
    overflow: "hidden",
    position: "relative",
    ...Platform.select({
      web: { boxShadow: "0 4px 12px rgba(0,0,0,0.10)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      },
    }),
  },
  cardHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1.15,
    zIndex: 1,
  },
  cardIconPattern: {
    zIndex: 0,
  },
  cardIconPatternItem: {
    position: "absolute",
    width: TASK_ICON_SIZE,
    height: TASK_ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-12deg" }],
  },
  checkboxButton: {
    width: 38,
    alignItems: "flex-start",
    paddingTop: 2,
    zIndex: 2,
  },
  checkboxIconSlot: {
    width: 30,
    height: 30,
    position: "relative",
  },
  checkboxIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    zIndex: 2,
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: 6,
    columnGap: 8,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: "800",
    ...Platform.select({
      web: { textShadow: "0 1px 2px rgba(0,0,0,0.24)" },
      default: {
        textShadowColor: "rgba(0,0,0,0.24)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  subjectNameWithSchedule: {
    flex: 1,
    minWidth: 130,
  },
  subjectNameSingle: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
  },
  createdAt: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: "auto",
  },
  schedulePill: {
    maxWidth: "62%",
    minHeight: 25,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  scheduleName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  taskText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    ...Platform.select({
      web: { textShadow: "0 1px 2px rgba(0,0,0,0.22)" },
      default: {
        textShadowColor: "rgba(0,0,0,0.22)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  cardDetails: {
    overflow: "hidden",
  },
  linksWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  linkChip: {
    minHeight: 32,
    maxWidth: "100%",
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkText: {
    maxWidth: 190,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 17,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    zIndex: 50,
  },
});
