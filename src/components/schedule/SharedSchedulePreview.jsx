import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowClockwise, ArrowRight, CalendarBlank, CalendarCheck, CaretDown, CaretUp, Clock } from 'phosphor-react-native';
import { buildScheduleExport } from '../../utils/scheduleExport';
import { getLocale, t } from '../../utils/i18n';
import { calculateScheduleWeek, getScheduleDayIndex } from '../../utils/scheduleTime';
import { getIconComponent } from '../../config/subjectIcons';
import { getSharedSchedulePreviewLiveLessons, getSharedSchedulePreviewRefreshAt, getSharedSchedulePreviewRows, getSharedSchedulePreviewSelection } from './sharedSchedulePreviewModel';

const formatDuration = (milliseconds, lang) => {
  const total = Math.max(1, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return t('share.live_minutes', lang, { count: total });
  return t(minutes ? 'share.live_hours_minutes' : 'share.live_hours', lang, { hours, minutes });
};

// live: { kind: 'current', label, progress } for the class in progress, { kind: 'next', label } for the next one.
function Lesson({ lesson, themeColors, lang, showTime = true, fill = false, live = null }) {
  const [expanded, setExpanded] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const Caret = expanded ? CaretUp : CaretDown;
  const hasDetails = !!(lesson.teacher || lesson.note || lesson.links.length);
  const current = live?.kind === 'current';
  const openLink = async url => {
    setLinkError(false);
    try { await Linking.openURL(url); } catch { setLinkError(true); }
  };
  const numberLabel = lesson.number ? t('share.preview_slot', lang, { number: lesson.number }) : t('share.preview_custom_time', lang);
  return <View style={[styles.lesson, fill && styles.gridLesson, { backgroundColor: themeColors.backgroundColor2,
    borderColor: current ? themeColors.accentColor : themeColors.borderColor }]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={(live ? live.label + ', ' : '') + numberLabel + ', ' + lesson.time + ', ' + lesson.title}
      accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} disabled={!hasDetails} style={styles.lessonHead}>
      <View style={styles.lessonText}>
        {!!live && <View style={[styles.liveBadge, current ? { backgroundColor: themeColors.accentColor }
          : { borderWidth: 1, borderColor: themeColors.borderColor }]}>
          {current && <View style={[styles.liveDot, { backgroundColor: themeColors.textOnAccent }]} />}
          <Text numberOfLines={1} style={[styles.liveBadgeText, { color: current ? themeColors.textOnAccent : themeColors.textColor2 }]}>{live.label}</Text>
        </View>}
        {showTime && <View style={styles.lessonTiming}>
          <Text style={[styles.slotNumber, { color: themeColors.textColor2 }]}>{numberLabel}</Text>
          <Text style={[styles.time, { color: themeColors.accentTextColor }]}>{lesson.time}</Text>
        </View>}
        {!showTime && !lesson.number && <Text style={[styles.count, { color: themeColors.textColor2 }]}>{numberLabel}</Text>}
        <Text style={[styles.subject, { color: themeColors.textColor }]}>{lesson.title}</Text>
        {!!(lesson.type || lesson.location) && <Text style={[styles.meta, { color: themeColors.textColor2 }]}>{[lesson.type, lesson.location].filter(Boolean).join(' · ')}</Text>}
      </View>
      {hasDetails && <Caret size={18} color={themeColors.textColor2} accessible={false} />}
    </TouchableOpacity>
    {expanded && <View style={[styles.details, { borderColor: themeColors.borderColor }]}>
      {!!lesson.teacher && <Text selectable style={[styles.meta, { color: themeColors.textColor2 }]}>{lesson.teacher}</Text>}
      {!!lesson.note && <Text selectable style={[styles.meta, { color: themeColors.textColor }]}>{lesson.note}</Text>}
      {lesson.links.map((link, index) => <TouchableOpacity key={index} accessibilityRole="link" accessibilityLabel={link.display} accessibilityHint={link.url}
        {...(Platform.OS === 'web' ? { href: link.url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : { onPress: () => openLink(link.url) })}
        style={styles.link}>
        <Text style={[styles.linkText, { color: themeColors.accentTextColor }]}>{link.display}</Text>
      </TouchableOpacity>)}
      {linkError && <Text accessibilityRole="alert" style={{ color: themeColors.textColor }}>{t('settings.about_screen.link_open_failed', lang)}</Text>}
    </View>}
    {current && <View style={[styles.lessonProgressTrack, { backgroundColor: themeColors.borderColor }]}>
      <View style={[styles.lessonProgress, { width: `${Math.round(live.progress * 100)}%`, backgroundColor: themeColors.accentColor }]} />
    </View>}
  </View>;
}

// The live line of the controls panel: the class in progress, the next one today, or the nearest one later.
function LiveStatus({ live, now, multiWeek, shown, onOpen, themeColors, lang }) {
  const { current, next } = live;
  const target = current || next;
  if (!target) return null;
  const today = next && next.date.toDateString() === new Date(now).toDateString();
  const date = new Intl.DateTimeFormat(getLocale(lang), { weekday: 'short', day: 'numeric', month: 'short' }).format(target.date);
  const label = t(current ? 'share.live_now' : today ? 'share.live_next_today' : 'share.live_upcoming', lang);
  const meta = current ? current.lesson.time + ' · ' + t('share.live_left', lang, { time: formatDuration(current.end - now, lang) })
    : today ? t('share.live_at', lang, { time: next.lesson.start }) + ' · ' + t('share.live_in', lang, { time: formatDuration(next.start - now, lang) })
      : t(multiWeek ? 'share.live_upcoming_meta_week' : 'share.live_upcoming_meta', lang, { date, week: next.week, time: next.lesson.start });
  const then = current && next && next.date.toDateString() === current.date.toDateString()
    && t('share.live_then', lang, { title: next.lesson.title, time: next.lesson.start });
  const progress = current ? Math.min(1, Math.max(0, (now - current.start) / (current.end - current.start))) : 0;
  const Container = shown ? View : TouchableOpacity;
  const SubjectIcon = getIconComponent(target.lesson.icon);
  return <Container {...(shown ? {} : { accessibilityRole: 'button', accessibilityHint: t('share.preview_next_lesson_open', lang), onPress: onOpen })}
    accessibilityLabel={[label, target.lesson.title, meta, then].filter(Boolean).join(', ')}
    style={[styles.liveStatus, { borderColor: themeColors.borderColor }]}>
    {/* One subject icon, as in the lesson viewer; the dot in the corner marks a class in progress. */}
    <View style={[styles.liveIcon, { backgroundColor: current ? themeColors.accentColor + '26' : themeColors.backgroundColor }]}>
      {SubjectIcon ? <SubjectIcon size={22} weight="regular" color={themeColors.accentTextColor} accessible={false} />
        : current ? <View style={[styles.liveIconDot, { backgroundColor: themeColors.accentColor }]} />
          : today ? <Clock size={18} weight="bold" color={themeColors.accentTextColor} accessible={false} />
            : <CalendarCheck size={18} weight="bold" color={themeColors.accentTextColor} accessible={false} />}
      {current && !!SubjectIcon && <View style={[styles.liveCornerDot, { backgroundColor: themeColors.accentColor, borderColor: themeColors.backgroundColor2 }]} />}
    </View>
    <View style={styles.liveText}>
      <Text style={[styles.liveLabel, { color: themeColors.accentTextColor }]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.liveTitle, { color: themeColors.textColor }]}>{target.lesson.title}</Text>
      <Text style={[styles.liveMeta, { color: themeColors.textColor2 }]}>{meta}</Text>
      {current && <View style={[styles.liveProgressTrack, { backgroundColor: themeColors.borderColor }]}>
        <View style={[styles.lessonProgress, { width: `${Math.round(progress * 100)}%`, backgroundColor: themeColors.accentColor }]} />
      </View>}
      {!!then && <Text style={[styles.liveMeta, { color: themeColors.textColor2 }]}>{then}</Text>}
    </View>
    {!shown && <ArrowRight size={18} weight="bold" color={themeColors.accentTextColor} accessible={false} />}
  </Container>;
}

// An empty week is still the author's choice, so it stays selectable; it is only dimmed and named on hover.
function WeekNumber({ week, selected, empty, onPress, themeColors, lang }) {
  const [hovered, setHovered] = useState(false);
  const emptyLabel = t('share.preview_week_empty', lang);
  return <Pressable accessibilityRole="button" accessibilityLabel={empty ? week.title + ', ' + emptyLabel : week.title}
    accessibilityState={{ selected }} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    style={({ pressed }) => [styles.weekNumber, { zIndex: hovered ? 1 : 0, opacity: pressed ? 0.7 : 1,
      borderStyle: empty && !selected ? 'dashed' : 'solid', borderColor: selected ? themeColors.accentColor : themeColors.borderColor,
      backgroundColor: selected ? themeColors.accentColor : 'transparent' }]}>
    <Text style={[styles.weekNumberText, { opacity: empty && !selected ? 0.45 : 1,
      color: selected ? themeColors.textOnAccent : themeColors.textColor }]}>{week.number}</Text>
    {empty && hovered && <View pointerEvents="none" style={[styles.weekTooltip, { backgroundColor: themeColors.textColor }]}>
      <Text numberOfLines={1} style={[styles.weekTooltipText, { color: themeColors.backgroundColor }]}>{emptyLabel}</Text>
    </View>}
  </Pressable>;
}

export default function SharedSchedulePreview({ schedule, lang, themeColors }) {
  const document = useMemo(() => buildScheduleExport(schedule, lang, { shareNotes: true }), [schedule, lang]);
  const [selection, setSelection] = useState(() => getSharedSchedulePreviewSelection(schedule));
  const [automatic, setAutomatic] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [width, setWidth] = useState(0);
  const dayScroll = useRef(null);
  const dayPositions = useRef({});
  const week = document.weeks.find(item => String(item.number) === selection.week) || document.weeks[0];
  const day = week.days.find(item => item.index === selection.day) || week.days[0];
  const wide = width >= 960;
  const rows = useMemo(() => getSharedSchedulePreviewRows(schedule, week), [schedule, week]);
  const mobileRows = useMemo(() => getSharedSchedulePreviewRows(schedule, { days: day ? [day] : [] }), [schedule, day]);
  const hasLessons = document.weeks.some(item => item.days.some(value => value.lessons.length));
  const weekEmpty = !week.days.some(value => value.lessons.length);
  const live = useMemo(() => getSharedSchedulePreviewLiveLessons(schedule, document, now), [schedule, document, now]);
  const liveTarget = live.current || live.next;
  const liveTargetShown = !!liveTarget && liveTarget.week === String(week.number) && (wide || liveTarget.day === day?.index);
  const today = { week: String(calculateScheduleWeek(schedule, now)), day: getScheduleDayIndex(now) };
  const isToday = item => today.week === String(week.number) && today.day === item.index;
  const liveOf = lesson => {
    if (live.current?.lesson === lesson) return { kind: 'current', progress: (now - live.current.start) / (live.current.end - live.current.start),
      label: t('share.live_now', lang) + ' · ' + t('share.live_left', lang, { time: formatDuration(live.current.end - now, lang) }) };
    if (live.next?.lesson === lesson) return { kind: 'next', label: t('share.live_next', lang) };
    return null;
  };
  const webRole = role => Platform.OS === 'web' ? role : undefined;
  const todayLabel = <Text style={[styles.liveLabel, { color: themeColors.accentTextColor }]}>{t('share.live_today', lang)}</Text>;

  // Re-evaluated when a class ends, at midnight and on return to the app, also while browsing manually,
  // so the next-class hint stays current.
  useEffect(() => {
    let timer;
    let active = true;
    const update = () => {
      if (!active) return;
      clearTimeout(timer);
      const current = new Date();
      setNow(current);
      timer = setTimeout(update, Math.max(1, Math.min(getSharedSchedulePreviewRefreshAt(schedule, current) - current.getTime(), 2147483647)));
    };
    update();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
  }, [schedule]);

  // Minutes left and the progress bar move while a class runs or the next one starts within a day.
  const ticking = !!live.current || (!!live.next && live.next.start - now < 86400000);
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, [ticking]);

  useEffect(() => {
    if (automatic) setSelection(getSharedSchedulePreviewSelection(schedule, now));
  }, [automatic, schedule, now]);

  useEffect(() => {
    if (!wide && day) dayScroll.current?.scrollTo?.({ x: Math.max(0, (dayPositions.current[day.index] || 0) - 8), animated: false });
  }, [day?.index, wide, week.number]);

  const chooseWeek = value => { setAutomatic(false); setSelection(previous => ({ ...previous, week: value })); };
  const chooseDay = value => { setAutomatic(false); setSelection(previous => ({ ...previous, day: value })); };
  const emptySlot = (row, title) => <View accessible accessibilityLabel={title + ', ' + row.start + ' – ' + row.end + ', ' + t('share.preview_free', lang)}
    style={[styles.emptySlot, { borderColor: themeColors.borderColor }]}><Text style={{ color: themeColors.textColor3 || themeColors.textColor2 }}>—</Text></View>;

  const openLiveTarget = () => {
    setAutomatic(false);
    setSelection({ week: liveTarget.week, day: liveTarget.day, date: liveTarget.date });
  };
  const autoButton = <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.preview_auto', lang)} accessibilityState={{ selected: automatic }}
    onPress={() => { setSelection(getSharedSchedulePreviewSelection(schedule)); setAutomatic(true); }}
    style={[styles.autoButton, { borderColor: automatic ? themeColors.accentColor : themeColors.borderColor, backgroundColor: automatic ? themeColors.backgroundColor : 'transparent' }]}>
    <ArrowClockwise size={16} weight="bold" color={themeColors.accentTextColor} accessible={false} />
    <Text style={[styles.autoButtonText, { color: themeColors.accentTextColor }]}>{t('share.preview_auto', lang)}</Text>
  </TouchableOpacity>;
  const multiWeek = document.weeks.length > 1;
  // An empty week or schedule replaces the grid with one message, so day headers with zero classes never stand alone.
  const emptyState = (weekEmpty || !hasLessons) && <View style={[styles.emptyState, { borderColor: themeColors.borderColor }]}>
    <CalendarBlank size={28} color={themeColors.textColor3 || themeColors.textColor2} accessible={false} />
    <Text accessibilityRole="header" style={[styles.emptyTitle, { color: themeColors.textColor }]}>
      {hasLessons && multiWeek ? t('share.preview_week_no_lessons', lang, { week: week.number }) : document.empty}</Text>
    {hasLessons && multiWeek && <Text style={[styles.emptyHint, { color: themeColors.textColor2 }]}>{t('share.preview_week_empty_hint', lang)}</Text>}
    {hasLessons && !!liveTarget && <TouchableOpacity accessibilityRole="button" onPress={openLiveTarget}
      style={[styles.emptyAction, { borderColor: themeColors.accentColor }]}>
      <Text style={[styles.emptyActionText, { color: themeColors.accentTextColor }]}>{t(live.current ? 'share.live_go_current' : 'share.live_go_next', lang)}</Text>
      <ArrowRight size={16} weight="bold" color={themeColors.accentTextColor} accessible={false} />
    </TouchableOpacity>}
  </View>;

  return <View style={styles.container} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={[styles.controls, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
      <View style={styles.controlsHeader}>
        <Text style={[styles.controlsLabel, { color: themeColors.textColor2 }]}>{t(multiWeek ? 'share.preview_week_picker' : 'share.preview_day_picker', lang)}</Text>
        {autoButton}
      </View>
      {/* Numbers wrap, so every week of a cycle of up to 12 weeks stays visible and reachable. */}
      {multiWeek && <View style={styles.weekNumbers}>
        {document.weeks.map(item => <WeekNumber key={item.number} week={item} selected={item.number === week.number}
          empty={!item.days.some(value => value.lessons.length)} onPress={() => chooseWeek(String(item.number))}
          themeColors={themeColors} lang={lang} />)}
      </View>}
      <LiveStatus live={live} now={now} multiWeek={multiWeek} shown={liveTargetShown} onOpen={openLiveTarget} themeColors={themeColors} lang={lang} />
    </View>
    {emptyState}
    {!emptyState && !wide && <ScrollView ref={dayScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
      {week.days.map(item => {
        const selected = item.index === day.index;
        return <TouchableOpacity key={item.index} accessibilityRole="button" accessibilityState={{ selected }}
          accessibilityLabel={isToday(item) ? item.title + ', ' + t('share.live_today', lang) : item.title}
          onLayout={event => {
            dayPositions.current[item.index] = event.nativeEvent.layout.x;
            if (selected) dayScroll.current?.scrollTo?.({ x: Math.max(0, event.nativeEvent.layout.x - 8), animated: false });
          }} onPress={() => chooseDay(item.index)} style={[styles.dayTab, { borderColor: selected ? themeColors.accentColor : themeColors.borderColor,
            backgroundColor: selected ? themeColors.accentColor : 'transparent' }]}>
          {isToday(item) && <View style={[styles.todayDot, { backgroundColor: selected ? themeColors.textOnAccent : themeColors.accentColor }]} />}
          <Text style={{ color: selected ? themeColors.textOnAccent : themeColors.textColor2, fontWeight: '600' }}>{item.title}</Text>
        </TouchableOpacity>;
      })}
    </ScrollView>}
    {!emptyState && (wide ? <View accessibilityRole={webRole('table')} accessibilityLabel={t('share.preview_grid', lang)} style={styles.grid}>
      <View accessibilityRole={webRole('row')} style={[styles.gridRow, styles.headerRow]}>
        <View accessibilityRole={webRole('columnheader')} style={[styles.timeColumn, styles.headerTimeColumn]}>
          <Text style={[styles.count, { color: themeColors.textColor2 }]}>{t('share.time', lang)}</Text>
        </View>
        {week.days.map(item => <View key={item.index} accessibilityRole={webRole('columnheader')} style={[styles.gridCell, styles.dayHeader]}>
          {isToday(item) && todayLabel}
          <View style={styles.dayHeading}>
            <Text accessibilityRole="header" style={[styles.dayTitle, { color: isToday(item) ? themeColors.accentTextColor : themeColors.textColor }]}>{item.title}</Text>
            <Text style={[styles.count, { color: themeColors.textColor2 }]}>{item.lessons.length}</Text>
          </View>
        </View>)}
      </View>
      {rows.map(row => <View key={row.key} accessibilityRole={webRole('row')} style={styles.gridRow}>
        <View accessibilityRole={webRole('rowheader')} style={styles.timeColumn}>
          <Text style={[styles.slotNumber, { color: themeColors.textColor }]}>{row.number ? t('share.preview_slot', lang, { number: row.number }) : t('share.preview_custom_time', lang)}</Text>
          <Text style={[styles.time, { color: themeColors.accentTextColor }]}>{row.start}</Text>
          <Text style={[styles.count, { color: themeColors.textColor2 }]}>{row.end}</Text>
        </View>
        {row.cells.map((lessons, index) => <View key={week.days[index].index} accessibilityRole={webRole('cell')} style={styles.gridCell}>
          {lessons.length ? lessons.map((lesson, position) => <Lesson key={week.number + ':' + index + ':' + position} lesson={lesson} showTime={false} fill live={liveOf(lesson)} themeColors={themeColors} lang={lang} />)
            : emptySlot(row, week.days[index].title)}
        </View>)}
      </View>)}
    </View> : day && <View style={styles.mobileDay}>
      <View style={styles.dayHeader}>
        {isToday(day) && todayLabel}
        <View style={styles.dayHeading}>
          <Text accessibilityRole="header" style={[styles.dayTitle, { color: isToday(day) ? themeColors.accentTextColor : themeColors.textColor }]}>{day.title}</Text>
          <Text style={[styles.count, { color: themeColors.textColor2 }]}>{day.lessons.length}</Text>
        </View>
      </View>
      {mobileRows.map(row => <View key={row.key} style={styles.mobileRow}>
        {row.cells[0].length ? row.cells[0].map((lesson, index) => <Lesson key={week.number + ':' + day.index + ':' + index} lesson={lesson} live={liveOf(lesson)} themeColors={themeColors} lang={lang} />)
          : <View style={[styles.mobileEmpty, { borderColor: themeColors.borderColor }]}>
            <Text style={[styles.count, { color: themeColors.textColor2 }]}>{row.number ? t('share.preview_slot', lang, { number: row.number }) : t('share.preview_free', lang)}</Text>
            <Text style={[styles.time, { color: themeColors.textColor2 }]}>{row.start} – {row.end}</Text>
            <Text style={[styles.count, { color: themeColors.textColor2 }]}>{t('share.preview_free', lang)}</Text>
          </View>}
      </View>)}
      {!mobileRows.length && <View style={[styles.dayEmpty, { borderColor: themeColors.borderColor }]}>
        <Text style={[styles.emptyHint, { color: themeColors.textColor2 }]}>{t('share.preview_day_empty', lang)}</Text>
      </View>}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 16 },
  controls: { gap: 14, padding: 16, borderWidth: 1, borderRadius: 20 },
  controlsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  controlsLabel: { flexShrink: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  autoButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderWidth: 1, borderRadius: 20 },
  autoButtonText: { fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24, borderWidth: 1, borderStyle: 'dashed', borderRadius: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  emptyAction: { marginTop: 8, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderWidth: 1, borderRadius: 22 },
  emptyActionText: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  dayEmpty: { alignItems: 'center', paddingVertical: 24, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16 },
  weekNumbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekNumber: { minWidth: 42, minHeight: 42, paddingHorizontal: 8, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  weekNumberText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  weekTooltip: { position: 'absolute', bottom: '100%', marginBottom: 6, alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  weekTooltipText: { fontSize: 12, fontWeight: '600' },
  dayTabs: { gap: 8 },
  dayTab: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayDot: { width: 6, height: 6, borderRadius: 3 },
  liveStatus: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  liveIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  liveCornerDot: { position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  liveIconDot: { width: 12, height: 12, borderRadius: 6 },
  liveText: { flex: 1, minWidth: 0, gap: 3 },
  liveLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  liveTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  liveMeta: { fontSize: 13, lineHeight: 19 },
  liveProgressTrack: { height: 4, marginTop: 6, marginBottom: 2, borderRadius: 2, overflow: 'hidden', maxWidth: 360 },
  liveBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveBadgeText: { fontSize: 11, fontWeight: '700' },
  lessonProgressTrack: { height: 3 },
  lessonProgress: { height: '100%' },
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  gridCell: { flex: 1, minWidth: 0, gap: 10 },
  timeColumn: { width: 90, flexShrink: 0, paddingVertical: 14, gap: 8 },
  emptySlot: { flex: 1, minHeight: 112, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  gridLesson: { flex: 1, minHeight: 112 },
  mobileDay: { gap: 12 },
  mobileRow: { gap: 10 },
  mobileEmpty: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lessonTiming: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  slotNumber: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  dayHeader: { justifyContent: 'flex-end', gap: 2 },
  headerRow: { alignItems: 'flex-end' },
  headerTimeColumn: { paddingVertical: 0, marginBottom: 6 },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  dayTitle: { fontSize: 17, fontWeight: '700' },
  count: { fontSize: 12 },
  lesson: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  lessonHead: { minHeight: 80, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lessonText: { flex: 1, minWidth: 0, gap: 8 },
  time: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  subject: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  meta: { fontSize: 13, lineHeight: 20 },
  details: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  link: { minHeight: 44, justifyContent: 'center', maxWidth: '100%' },
  linkText: { fontSize: 14, textDecorationLine: 'underline', flexShrink: 1 },
});
