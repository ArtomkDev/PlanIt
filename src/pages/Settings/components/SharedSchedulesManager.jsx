import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowClockwise, Check, Copy, Eye, ShareNetwork } from 'phosphor-react-native';
import { useScheduleData } from '../../../context/ScheduleProvider';
import useSharedScheduleActions from '../../../hooks/useSharedScheduleActions';
import useSharedScheduleClock from '../../../hooks/useSharedScheduleClock';
import { createSharedScheduleLink, getSharedScheduleStatus, getSharedScheduleTimestamp, getUserSharedSchedules } from '../../../services/shareService';
import SettingsScreenLayout from '../../../layouts/SettingsScreenLayout';
import MorphingLoader from '../../../components/ui/MorphingLoader';
import TabSwitcher from '../../../components/ui/TabSwitcher';
import themes from '../../../config/themes';
import { t, getLocale } from '../../../utils/i18n';

const EMPTY_LIST = [];
const PAGE_SIZE = 20;

export default function SharedSchedulesManager({ navigation }) {
  const { user, global, lang } = useScheduleData();
  const userId = user?.uid;
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const colors = themes.getColors(mode, accent);
  const [result, setResult] = useState({ userId, items: EMPTY_LIST, loading: true, error: false });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const current = result.userId === userId;
  const items = current ? result.items : EMPTY_LIST;
  const now = useSharedScheduleClock(items);
  const actions = useSharedScheduleActions({ userId, lang, onDeleted: code => {
    setResult(previous => previous.userId === userId ? { ...previous, items: previous.items.filter(item => item.id !== code) } : previous);
  } });

  useEffect(() => { setFilter('all'); setPage(0); }, [userId]);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) {
      setResult({ userId, items: EMPTY_LIST, loading: false, error: false });
      return;
    }
    setResult(previous => ({ userId, items: previous.userId === userId ? previous.items : EMPTY_LIST, loading: true, error: false }));
    getUserSharedSchedules(userId).then(data => {
      if (active) setResult({ userId, items: data, loading: false, error: false });
    }).catch(() => {
      if (active) setResult(previous => ({ ...previous, loading: false, error: true }));
    });
    return () => { active = false; };
  }, [userId, attempt]));

  const activeCount = items.filter(item => getSharedScheduleStatus(item, now) === 'active').length;
  const filtered = items.filter(item => filter === 'all' || (getSharedScheduleStatus(item, now) === 'active') === (filter === 'active'));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const loading = !current || result.loading;
  const dateLabel = value => {
    const timestamp = getSharedScheduleTimestamp(value);
    return timestamp === null ? t('share.manager_unknown_date', lang) : new Intl.DateTimeFormat(getLocale(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
  };

  return <SettingsScreenLayout title={t('settings.menu.shared_schedules.title', lang)}>
    <View style={styles.content}>
      <View style={styles.intro}>
        <View style={[styles.heroIcon, { backgroundColor: colors.accentColor + '18' }]}><ShareNetwork size={26} color={colors.accentTextColor} accessible={false} /></View>
        <View style={styles.introText}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textColor }]}>{t('share.manager_summary', lang, { count: activeCount })}</Text>
          <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.manager_hint', lang)}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.manager_refresh', lang)} disabled={loading || !!actions.pending || !userId}
          accessibilityState={{ disabled: loading || !!actions.pending || !userId, busy: loading }} onPress={() => setAttempt(value => value + 1)} style={styles.refresh}>
          {loading && items.length ? <MorphingLoader size={22} /> : <ArrowClockwise size={22} color={colors.accentTextColor} accessible={false} />}
        </TouchableOpacity>
      </View>
      {!userId ? <Text style={[styles.empty, { color: colors.textColor2 }]}>{t('share.manager_account_required', lang)}</Text> : <>
        {!!items.length && <TabSwitcher themeColors={colors} activeTab={filter} onTabPress={value => { setFilter(value); setPage(0); }} tabs={[
          { id: 'all', label: t('share.manager_all', lang) + ' · ' + items.length },
          { id: 'active', label: t('share.manager_active', lang) + ' · ' + activeCount },
          { id: 'ended', label: t('share.manager_ended', lang) + ' · ' + (items.length - activeCount) },
        ]} />}
        {current && result.error && <View style={styles.feedback}>
          <Text accessibilityRole="alert" style={[styles.meta, { color: colors.textColor }]}>{t('share.manager_load_failed', lang)}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} disabled={loading} style={styles.refresh}>
            <Text style={{ color: colors.accentTextColor }}>{t('common.retry', lang)}</Text>
          </TouchableOpacity>
        </View>}
        {loading && !items.length ? <View accessibilityRole="progressbar" accessibilityLabel={t('schedule.loading', lang)} style={styles.empty}><MorphingLoader size={58} /></View>
          : !filtered.length && !result.error ? <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.textColor }]}>{t(items.length ? 'share.manager_filter_empty' : 'share.manager_empty', lang)}</Text>
            <Text style={[styles.meta, { color: colors.textColor2 }]}>{t(items.length ? 'share.manager_filter_hint' : 'share.manager_empty_hint', lang)}</Text>
          </View> : visibleItems.map(item => {
            const status = getSharedScheduleStatus(item, now);
            const isActive = status === 'active';
            const copied = actions.copied?.code === item.id && actions.copied.action === 'link';
            const CopyIcon = copied ? Check : Copy;
            return <View key={item.id} style={[styles.card, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.name, { color: colors.textColor }]} numberOfLines={2}>{item.scheduleName || t('share.open_title', lang)}</Text>
                <View style={[styles.badge, { backgroundColor: isActive ? colors.accentColor + '18' : colors.backgroundColor3 }]}>
                  <Text style={[styles.status, { color: isActive ? colors.accentTextColor : colors.textColor2 }]}>{t('share.status_' + status, lang)}</Text>
                </View>
              </View>
              <Text selectable style={[styles.url, { color: isActive ? colors.accentTextColor : colors.textColor2 }]}>{createSharedScheduleLink(item.id)}</Text>
              <View style={styles.dates}>
                <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.manager_expires', lang)}: {dateLabel(item.expiresAt)}</Text>
                <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.code_label', lang)}: {item.id}</Text>
              </View>
              {actions.error?.code === item.id && <Text accessibilityRole="alert" style={[styles.meta, { color: colors.textColor }]}>{t(actions.error.key, lang)}</Text>}
              <View style={[styles.buttons, { borderColor: colors.borderColor }]}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.manager_details', lang) + ': ' + item.scheduleName}
                  disabled={!!actions.pending} style={[styles.button, { backgroundColor: colors.backgroundColor3 }]}
                  onPress={() => navigation.navigate('SharedScheduleDetails', { code: item.id })}>
                  <Eye size={19} color={colors.textColor} accessible={false} />
                  <Text style={[styles.buttonLabel, { color: colors.textColor }]}>{t('share.manager_details', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.copy_link', lang) + ': ' + item.scheduleName}
                  accessibilityState={{ disabled: !isActive || !!actions.pending, busy: actions.pending?.code === item.id }}
                  disabled={!isActive || !!actions.pending} onPress={() => actions.copyLink(item)}
                  style={[styles.button, { backgroundColor: colors.accentColor, opacity: !isActive || actions.pending ? 0.45 : 1 }]}>
                  <CopyIcon size={19} color={colors.textOnAccent} accessible={false} />
                  <Text accessibilityLiveRegion="polite" style={[styles.buttonLabel, { color: colors.textOnAccent }]}>{t(copied ? 'common.copied' : 'share.copy_link', lang)}</Text>
                </TouchableOpacity>
              </View>
            </View>;
          })}
        {pageCount > 1 && <View style={styles.pagination}>
          <TouchableOpacity accessibilityRole="button" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} style={styles.refresh}>
            <Text style={{ color: currentPage === 0 ? colors.textColor2 : colors.accentTextColor }}>{t('share.manager_previous', lang)}</Text>
          </TouchableOpacity>
          <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.manager_page', lang, { current: currentPage + 1, total: pageCount })}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={currentPage === pageCount - 1} onPress={() => setPage(currentPage + 1)} style={styles.refresh}>
            <Text style={{ color: currentPage === pageCount - 1 ? colors.textColor2 : colors.accentTextColor }}>{t('share.manager_next', lang)}</Text>
          </TouchableOpacity>
        </View>}
      </>}
    </View>
  </SettingsScreenLayout>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, gap: 20 },
  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 27 },
  meta: { fontSize: 13, lineHeight: 20 },
  refresh: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  feedback: { gap: 8, padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  name: { flex: 1, minWidth: 130, fontSize: 18, fontWeight: '700', lineHeight: 25 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  status: { fontSize: 12, fontWeight: '600' },
  url: { fontSize: 13, lineHeight: 21 },
  dates: { gap: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  button: { flex: 1, minWidth: 130, minHeight: 48, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  buttonLabel: { flexShrink: 1, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
