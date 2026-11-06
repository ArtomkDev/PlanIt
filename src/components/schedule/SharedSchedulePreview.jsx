import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowClockwise, CaretDown, CaretUp } from 'phosphor-react-native';
import TabSwitcher from '../ui/TabSwitcher';
import { buildScheduleExport } from '../../utils/scheduleExport';
import { getLocale, t } from '../../utils/i18n';
import { getSharedSchedulePreviewRows, getSharedSchedulePreviewSelection, getSharedSchedulePreviewRefreshAt } from './sharedSchedulePreviewModel';

function Lesson({ lesson, themeColors, lang, showTime = true, fill = false }) {
  const [expanded, setExpanded] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const Caret = expanded ? CaretUp : CaretDown;
  const hasDetails = !!(lesson.teacher || lesson.note || lesson.links.length);
  const openLink = async url => {
    setLinkError(false);
    try { await Linking.openURL(url); } catch { setLinkError(true); }
  };
  const numberLabel = lesson.number ? t('share.preview_slot', lang, { number: lesson.number }) : t('share.preview_custom_time', lang);
  return <View style={[styles.lesson, fill && styles.gridLesson, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={numberLabel + ', ' + lesson.time + ', ' + lesson.title}
      accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} disabled={!hasDetails} style={styles.lessonHead}>
      <View style={styles.lessonText}>
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
  </View>;
}

export default function SharedSchedulePreview({ schedule, lang, themeColors }) {
  const document = useMemo(() => buildScheduleExport(schedule, lang, { shareNotes: true }), [schedule, lang]);
  const [selection, setSelection] = useState(() => getSharedSchedulePreviewSelection(schedule));
  const [automatic, setAutomatic] = useState(true);
  const [width, setWidth] = useState(0);
  const dayScroll = useRef(null);
  const dayPositions = useRef({});
  const week = document.weeks.find(item => String(item.number) === selection.week) || document.weeks[0];
  const day = week.days.find(item => item.index === selection.day) || week.days[0];
  const wide = width >= 960;
  const rows = useMemo(() => getSharedSchedulePreviewRows(schedule, week), [schedule, week]);
  const mobileRows = useMemo(() => getSharedSchedulePreviewRows(schedule, { days: day ? [day] : [] }), [schedule, day]);
  const hasLessons = document.weeks.some(item => item.days.some(value => value.lessons.length));
  const webRole = role => Platform.OS === 'web' ? role : undefined;

  useEffect(() => {
    if (!automatic) return;
    let timer;
    let active = true;
    const update = () => {
      if (!active) return;
      clearTimeout(timer);
      const now = new Date();
      setSelection(getSharedSchedulePreviewSelection(schedule, now));
      timer = setTimeout(update, Math.max(1, Math.min(getSharedSchedulePreviewRefreshAt(schedule, now) - now.getTime(), 2147483647)));
    };
    update();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
  }, [automatic, schedule]);

  useEffect(() => {
    if (!wide && day) dayScroll.current?.scrollTo?.({ x: Math.max(0, (dayPositions.current[day.index] || 0) - 8), animated: false });
  }, [day?.index, wide, week.number]);

  const chooseWeek = value => { setAutomatic(false); setSelection(previous => ({ ...previous, week: value })); };
  const chooseDay = value => { setAutomatic(false); setSelection(previous => ({ ...previous, day: value })); };
  const emptySlot = (row, title) => <View accessible accessibilityLabel={title + ', ' + row.start + ' – ' + row.end + ', ' + t('share.preview_free', lang)}
    style={[styles.emptySlot, { borderColor: themeColors.borderColor }]}><Text style={{ color: themeColors.textColor3 || themeColors.textColor2 }}>—</Text></View>;

  return <View style={styles.container} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {document.weeks.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScroll}>
      <View style={{ flexGrow: 1, minWidth: document.weeks.length * 110 }}>
        <TabSwitcher tabs={document.weeks.map(item => ({ id: String(item.number), label: item.title }))}
          activeTab={String(week.number)} onTabPress={chooseWeek} themeColors={themeColors} />
      </View>
    </ScrollView>}
    <View style={styles.autoBar}>
      <Text style={[styles.autoHint, { color: themeColors.textColor2 }]}>{automatic ? hasLessons
        ? t('share.preview_relevant_date', lang, { date: new Intl.DateTimeFormat(getLocale(lang), { weekday: 'short', day: 'numeric', month: 'short' }).format(selection.date) })
        : document.empty : t('share.preview_manual', lang)}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.preview_auto', lang)} accessibilityState={{ selected: automatic }}
        onPress={() => { setSelection(getSharedSchedulePreviewSelection(schedule)); setAutomatic(true); }}
        style={[styles.autoButton, { borderColor: automatic ? themeColors.accentColor : themeColors.borderColor, backgroundColor: automatic ? themeColors.backgroundColor2 : 'transparent' }]}>
        <ArrowClockwise size={17} color={themeColors.accentTextColor} accessible={false} />
        <Text style={{ color: themeColors.accentTextColor, fontWeight: '600' }}>{t('share.preview_auto', lang)}</Text>
      </TouchableOpacity>
    </View>
    {!wide && <ScrollView ref={dayScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
      {week.days.map(item => <TouchableOpacity key={item.index} accessibilityRole="button" accessibilityState={{ selected: item.index === day.index }}
        onLayout={event => {
          dayPositions.current[item.index] = event.nativeEvent.layout.x;
          if (item.index === day.index) dayScroll.current?.scrollTo?.({ x: Math.max(0, event.nativeEvent.layout.x - 8), animated: false });
        }} onPress={() => chooseDay(item.index)} style={[styles.dayTab, { borderColor: item.index === day.index ? themeColors.accentColor : themeColors.borderColor,
          backgroundColor: item.index === day.index ? themeColors.backgroundColor2 : 'transparent' }]}>
        <Text style={{ color: item.index === day.index ? themeColors.accentTextColor : themeColors.textColor2, fontWeight: '600' }}>{item.title}</Text>
      </TouchableOpacity>)}
    </ScrollView>}
    {wide ? <View accessibilityRole={webRole('table')} accessibilityLabel={t('share.preview_grid', lang)} style={styles.grid}>
      <View accessibilityRole={webRole('row')} style={styles.gridRow}>
        <View accessibilityRole={webRole('columnheader')} style={styles.timeColumn}>
          <Text style={[styles.count, { color: themeColors.textColor2 }]}>{t('share.time', lang)}</Text>
        </View>
        {week.days.map(item => <View key={item.index} accessibilityRole={webRole('columnheader')} style={styles.gridCell}>
          <View style={styles.dayHeading}>
            <Text accessibilityRole="header" style={[styles.dayTitle, { color: themeColors.textColor }]}>{item.title}</Text>
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
          {lessons.length ? lessons.map((lesson, position) => <Lesson key={week.number + ':' + index + ':' + position} lesson={lesson} showTime={false} fill themeColors={themeColors} lang={lang} />)
            : emptySlot(row, week.days[index].title)}
        </View>)}
      </View>)}
      {!rows.length && <Text style={[styles.empty, { color: themeColors.textColor2 }]}>{document.empty}</Text>}
    </View> : day && <View style={styles.mobileDay}>
      <View style={styles.dayHeading}>
        <Text accessibilityRole="header" style={[styles.dayTitle, { color: themeColors.textColor }]}>{day.title}</Text>
        <Text style={[styles.count, { color: themeColors.textColor2 }]}>{day.lessons.length}</Text>
      </View>
      {mobileRows.map(row => <View key={row.key} style={styles.mobileRow}>
        {row.cells[0].length ? row.cells[0].map((lesson, index) => <Lesson key={week.number + ':' + day.index + ':' + index} lesson={lesson} themeColors={themeColors} lang={lang} />)
          : <View style={[styles.mobileEmpty, { borderColor: themeColors.borderColor }]}>
            <Text style={[styles.count, { color: themeColors.textColor2 }]}>{row.number ? t('share.preview_slot', lang, { number: row.number }) : t('share.preview_free', lang)}</Text>
            <Text style={[styles.time, { color: themeColors.textColor2 }]}>{row.start} – {row.end}</Text>
            <Text style={[styles.count, { color: themeColors.textColor2 }]}>{t('share.preview_free', lang)}</Text>
          </View>}
      </View>)}
      {!mobileRows.length && <Text style={[styles.empty, { color: themeColors.textColor2 }]}>{document.empty}</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 20 },
  weekScroll: { flexGrow: 1 },
  dayTabs: { gap: 8 },
  dayTab: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  autoBar: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  autoHint: { flex: 1, fontSize: 13, lineHeight: 20 },
  autoButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
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
  empty: { paddingVertical: 24, fontSize: 14 },
});
