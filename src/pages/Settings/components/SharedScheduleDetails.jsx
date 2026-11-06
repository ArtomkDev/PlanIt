import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Check, Copy, ShareNetwork, Trash, ArrowSquareOut } from 'phosphor-react-native';
import { useScheduleData } from '../../../context/ScheduleProvider';
import useSharedScheduleActions from '../../../hooks/useSharedScheduleActions';
import useSharedScheduleClock from '../../../hooks/useSharedScheduleClock';
import { createSharedScheduleLink, createSharedSchedulePath, getOwnedSharedSchedule, getSharedScheduleErrorKey, getSharedScheduleStatus, getSharedScheduleTimestamp } from '../../../services/shareService';
import SettingsScreenLayout from '../../../layouts/SettingsScreenLayout';
import SettingsGroup from '../../../components/ui/SettingsKit/SettingsGroup';
import SettingsRow from '../../../components/ui/SettingsKit/SettingsRow';
import SharedSchedulePreview from '../../../components/schedule/SharedSchedulePreview';
import MorphingLoader from '../../../components/ui/MorphingLoader';
import themes from '../../../config/themes';
import { getLocale, t } from '../../../utils/i18n';

export default function SharedScheduleDetails({ navigation, route }) {
  const { user, global, lang } = useScheduleData();
  const userId = user?.uid;
  const code = route.params?.code;
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const colors = themes.getColors(mode, accent);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const current = result?.userId === userId && result?.code === code;
  const item = current ? result.item : null;
  const shares = useMemo(() => item ? [item] : [], [item]);
  const now = useSharedScheduleClock(shares);
  const status = getSharedScheduleStatus(item, now);
  const active = !!item && status === 'active';
  const actions = useSharedScheduleActions({ userId, shareCode: code, lang, onDeleted: () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('SharedSchedulesManager');
  } });

  useFocusEffect(useCallback(() => {
    let mounted = true;
    setResult(null);
    if (userId) getOwnedSharedSchedule(userId, code).then(data => {
      if (mounted) setResult({ userId, code, item: data });
    }).catch(error => {
      if (mounted) setResult({ userId, code, error: getSharedScheduleErrorKey(error) });
    });
    return () => { mounted = false; };
  }, [userId, code, attempt]));

  const dateLabel = value => {
    const timestamp = getSharedScheduleTimestamp(value);
    return timestamp === null ? t('share.manager_unknown_date', lang)
      : new Intl.DateTimeFormat(getLocale(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
  };
  const copiedLink = actions.copied?.code === item?.id && actions.copied?.action === 'link';
  const copiedCode = actions.copied?.code === item?.id && actions.copied?.action === 'code';
  const CopyIcon = copiedLink ? Check : Copy;
  const url = item ? createSharedScheduleLink(item.id) : '';

  return <SettingsScreenLayout title={t('share.manager_details_title', lang)}>
    <View style={styles.content}>
      {!userId ? <Text style={[styles.message, { color: colors.textColor2 }]}>{t('share.manager_account_required', lang)}</Text>
        : current && result.error ? <View style={styles.state}>
          <Text accessibilityRole="alert" style={[styles.message, { color: colors.textColor }]}>{t(result.error, lang)}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.button}>
            <Text style={{ color: colors.accentTextColor }}>{t('common.retry', lang)}</Text>
          </TouchableOpacity>
        </View> : !item ? <View accessibilityRole="progressbar" accessibilityLabel={t('schedule.loading', lang)} style={styles.state}><MorphingLoader size={58} /></View> : <>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.name, { color: colors.textColor }]}>{item.scheduleName || t('share.open_title', lang)}</Text>
            <View style={[styles.badge, { backgroundColor: active ? colors.accentColor + '18' : colors.backgroundColor3 }]}>
              <Text style={{ color: active ? colors.accentTextColor : colors.textColor2, fontWeight: '600' }}>{t('share.status_' + status, lang)}</Text>
            </View>
          </View>
          <Text style={[styles.message, { color: colors.textColor2 }]}>{t(active ? 'share.manager_public_hint' : 'share.manager_ended_hint', lang)}</Text>
          <View style={[styles.linkCard, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}>
            <Text style={[styles.label, { color: colors.textColor2 }]}>{t('share.manager_link', lang)}</Text>
            <Text selectable style={[styles.link, { color: colors.accentTextColor }]}>{url}</Text>
            <View style={styles.actions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.copy_link', lang)} disabled={!active || !!actions.pending}
                accessibilityState={{ disabled: !active || !!actions.pending, busy: actions.pending?.action === 'link' }}
                onPress={() => actions.copyLink(item)} style={[styles.button, { backgroundColor: colors.accentColor, opacity: !active || actions.pending ? 0.45 : 1 }]}>
                <CopyIcon size={20} color={colors.textOnAccent} accessible={false} />
                <Text accessibilityLiveRegion="polite" style={[styles.buttonText, { color: colors.textOnAccent }]}>{t(copiedLink ? 'common.copied' : 'share.copy_link', lang)}</Text>
              </TouchableOpacity>
              {actions.canShare && <TouchableOpacity accessibilityRole="button" disabled={!active || !!actions.pending}
                accessibilityState={{ disabled: !active || !!actions.pending }} onPress={() => actions.shareLink(item)}
                style={[styles.button, { backgroundColor: colors.backgroundColor3, opacity: !active || actions.pending ? 0.45 : 1 }]}>
                <ShareNetwork size={20} color={colors.textColor} accessible={false} />
                <Text style={[styles.buttonText, { color: colors.textColor }]}>{t('share.manager_share', lang)}</Text>
              </TouchableOpacity>}
            </View>
            {active && <TouchableOpacity accessibilityRole="link" accessibilityLabel={t('share.manager_open_public', lang)} disabled={!!actions.pending}
              {...(Platform.OS === 'web' ? { href: createSharedSchedulePath(item.id), hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }
                : { onPress: () => navigation.navigate('SharedSchedule', { code: item.id }) })} style={styles.publicLink}>
              <ArrowSquareOut size={18} color={colors.accentTextColor} accessible={false} />
              <Text style={{ color: colors.accentTextColor }}>{t('share.manager_open_public', lang)}</Text>
            </TouchableOpacity>}
          </View>
          {actions.error?.code === item.id && <Text accessibilityRole="alert" style={[styles.message, { color: colors.textColor }]}>{t(actions.error.key, lang)}</Text>}
          <SettingsGroup themeColors={colors}>
            <SettingsRow label={t('share.code_label', lang)} value={item.id} valuePosition="below" themeColors={colors}
              accessibilityLabel={t('share.manager_copy_code', lang)} accessibilityState={{ disabled: !active || !!actions.pending }}
              disabled={!active || !!actions.pending} onPress={() => actions.copyCode(item)} showCaret={false}
              rightContent={copiedCode ? <Check size={20} color={colors.accentTextColor} accessible={false} /> : <Copy size={20} color={colors.textColor2} accessible={false} />} />
            <SettingsRow label={t('share.manager_created', lang)} value={dateLabel(item.createdAt)} valuePosition="below" themeColors={colors} showCaret={false} />
            <SettingsRow label={t('share.manager_expires', lang)} value={dateLabel(item.expiresAt)} valuePosition="below" themeColors={colors} showCaret={false} />
          </SettingsGroup>
          <View style={styles.previewHeading}>
            <Text accessibilityRole="header" style={[styles.previewTitle, { color: colors.textColor }]}>{t('share.manager_snapshot', lang)}</Text>
            <Text style={[styles.message, { color: colors.textColor2 }]}>{t('share.snapshot_hint', lang)}</Text>
          </View>
          {item.previewError ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.textColor }]}>{t(item.previewError, lang)}</Text>
            : <SharedSchedulePreview key={item.id} schedule={item.scheduleData} lang={lang} themeColors={colors} />}
          <SettingsGroup themeColors={colors} title={t('share.manager_access', lang)}>
            <SettingsRow label={t(active ? 'share.deactivate_btn' : 'share.manager_remove', lang)} desc={t(active ? 'share.deactivate_desc' : 'share.manager_remove_desc', lang)}
              danger icon={Trash} themeColors={colors} disabled={!!actions.pending} accessibilityState={{ busy: actions.pending?.action === 'delete' }}
              onPress={() => actions.remove(item)} showCaret={false} />
          </SettingsGroup>
        </>}
    </View>
  </SettingsScreenLayout>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1280, alignSelf: 'center', padding: 20, gap: 20 },
  state: { alignItems: 'center', paddingVertical: 48, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  name: { flex: 1, minWidth: 160, fontSize: 28, fontWeight: '700', lineHeight: 36 },
  badge: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10 },
  message: { fontSize: 14, lineHeight: 22 },
  linkCard: { padding: 18, borderWidth: 1, borderRadius: 18, gap: 16 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  link: { fontSize: 14, lineHeight: 23 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minWidth: 140, minHeight: 50, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { flexShrink: 1, fontSize: 15, fontWeight: '600' },
  publicLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  previewHeading: { gap: 8 },
  previewTitle: { fontSize: 20, fontWeight: '700' },
});
