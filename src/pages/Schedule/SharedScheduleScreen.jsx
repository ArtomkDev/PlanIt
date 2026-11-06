import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { CaretDown, CaretUp, DownloadSimple, ArrowLeft } from 'phosphor-react-native';
import PlanItWordmark from '../../components/ui/PlanItWordmark';
import SharedScheduleAccessSheet from '../../components/schedule/SharedScheduleAccessSheet';
import { hasLegalAcceptance, recordLegalAcceptance } from '../../services/legalAcceptanceService';
import { fetchSharedSchedule, prepareSharedScheduleImport, readSharedScheduleImport, clearSharedScheduleImport } from '../../services/shareService';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useScheduleActions, useScheduleData } from '../../context/ScheduleProvider';
import useAppTheme from '../../hooks/useAppTheme';
import MorphingLoader from '../../components/ui/MorphingLoader';
import { getSharedScheduleErrorKey, subscribeToSharedSchedule } from '../../services/shareService';
import { sanitizeImportedSchedule } from '../../utils/scheduleValidation';
import { getLocale, t } from '../../utils/i18n';
import { getLegalDocumentBrowserUrl } from '../../utils/legalDocumentLinks';
import SharedSchedulePreview from '../../components/schedule/SharedSchedulePreview';

export default function SharedScheduleScreen({ route, navigation, fallbackRoute, onGuestLogin }) {
  const { lang, user, guest, isLoading } = useScheduleData();
  const { addSchedule } = useScheduleActions();
  const { colors, colorScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const code = route.params?.code;
  const [result, setResult] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [legalLinkError, setLegalLinkError] = useState(false);
  const [accessVisible, setAccessVisible] = useState(false);
  const [needsAcceptance, setNeedsAcceptance] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const resumeAttemptRef = useRef(null);
  const busyRef = useRef(false);
  const scopeRef = useRef(null);
  const scope = `${user?.uid || (guest ? 'guest' : 'signed-out')}:${code}`;
  scopeRef.current = scope;

  useEffect(() => {
    scopeRef.current = scope;
    resumeAttemptRef.current = null;
    busyRef.current = false;
    setSaving(false);
    setSaved(false);
    setSaveError(false);
    setAccessVisible(false);
    return () => { scopeRef.current = null; };
  }, [scope]);

  useFocusEffect(useCallback(() => {
    let active = true;
    let unsubscribe;
    let loadingTimer;
    setResult(null);
    setErrorKey(null);
    const fail = (error) => {
      if (!active) return;
      clearTimeout(loadingTimer);
      setResult(null);
      setErrorKey(getSharedScheduleErrorKey(error));
    };
    const listen = () => {
      unsubscribe?.();
      clearTimeout(loadingTimer);
      loadingTimer = setTimeout(() => fail(new Error('unavailable')), 15000);
      try {
        unsubscribe = subscribeToSharedSchedule(code, (data) => {
          if (!active) return;
          clearTimeout(loadingTimer);
          setResult({ code, data });
          setErrorKey(null);
        }, fail);
      } catch (error) { fail(error); }
    };
    listen();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setResult(null);
        setErrorKey(null);
        listen();
      }
    });
    return () => { active = false; clearTimeout(loadingTimer); unsubscribe?.(); subscription.remove(); };
  }, [code, attempt]));

  const shared = result?.code === code ? result.data : null;
  useEffect(() => {
    if (!shared) return;
    const expire = () => {
      setResult(null);
      setErrorKey('share.error_expired');
    };
    const remaining = shared.expiresAt - Date.now();
    if (remaining <= 0) { expire(); return; }
    // A share can last 30 days, longer than the maximum JS timeout.
    const timer = setTimeout(remaining > 2147483647 ? () => setAttempt(value => value + 1) : expire, Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [shared]);

  const openSavedCopy = () => navigation.reset({ index: 0, routes: [{
    name: 'MainLayout', params: { screen: 'Tabs', params: { screen: 'ScheduleTab' } },
  }] });

  const saveCopy = async () => {
    if (!shared || busyRef.current || saved || scopeRef.current !== scope || ((user || guest) && isLoading)) return;
    busyRef.current = true;
    setSaving(true);
    setSaveError(false);
    const savingScope = scope;
    try {
      if (!user && !guest) {
        const accepted = await hasLegalAcceptance('entry');
        if (scopeRef.current !== savingScope) return;
        setNeedsAcceptance(!accepted);
        await prepareSharedScheduleImport(code);
        if (scopeRef.current === savingScope) setAccessVisible(true);
        return;
      }
      const targetScope = user ? 'user:' + user.uid : 'guest';
      const intent = await prepareSharedScheduleImport(code, { stage: 'ready', scope: targetScope });
      if (scopeRef.current !== savingScope) return;
      const fresh = await fetchSharedSchedule(code);
      if (scopeRef.current !== savingScope) return;
      const copy = { ...sanitizeImportedSchedule(fresh.scheduleData), id: intent.copyId };
      await addSchedule(copy, { persistLocally: true, select: true });
      if (scopeRef.current !== savingScope) return;
      await clearSharedScheduleImport(intent.copyId);
      if (scopeRef.current !== savingScope) return;
      setSaved(true);
      openSavedCopy();
    } catch (error) {
      if (scopeRef.current === savingScope) setSaveError(getSharedScheduleErrorKey(error));
    } finally {
      if (scopeRef.current === savingScope) {
        busyRef.current = false;
        setSaving(false);
      }
    }
  };

  useEffect(() => {
    if (!shared || (!user && !guest) || isLoading || resumeAttemptRef.current === scope) return;
    let active = true;
    (async () => {
      const intent = await readSharedScheduleImport();
      if (!active || intent?.code !== code || !['auth', 'ready'].includes(intent.stage)) return;
      const targetScope = user ? 'user:' + user.uid : 'guest';
      if (intent.scope && intent.scope !== targetScope) return;
      resumeAttemptRef.current = scope;
      await saveCopy();
    })().catch(() => { if (active) setSaveError('common.action_failed'); });
    return () => { active = false; };
  }, [shared, user?.uid, guest, isLoading, scope]);

  const continueAccess = async (mode, accepted) => {
    if (user || guest || busyRef.current || scopeRef.current !== scope || (needsAcceptance && !accepted)) return;
    busyRef.current = true;
    setSaving(true);
    setSaveError(false);
    const continuingScope = scope;
    try {
      const targetScope = mode === 'guest' ? 'guest' : 'entry';
      if (needsAcceptance || mode === 'guest') await recordLegalAcceptance(lang, targetScope);
      if (scopeRef.current !== continuingScope) return;
      if (mode === 'guest') {
        await prepareSharedScheduleImport(code, { stage: 'ready', scope: 'guest' });
        if (scopeRef.current !== continuingScope) return;
        setAccessVisible(false);
        onGuestLogin();
      } else {
        const intent = await prepareSharedScheduleImport(code, { stage: 'auth', authView: mode, scope: null });
        if (scopeRef.current !== continuingScope) return;
        setAccessVisible(false);
        navigation.navigate('Auth', { importRequestId: intent.copyId });
      }
    } catch { setSaveError('common.action_failed'); }
    finally { if (scopeRef.current === continuingScope) { busyRef.current = false; setSaving(false); } }
  };

  const closeAccess = async () => {
    if (busyRef.current) return;
    try {
      const pending = await readSharedScheduleImport();
      if (pending?.code === code) await clearSharedScheduleImport(pending.copyId);
      setAccessVisible(false);
    }
    catch { setSaveError('common.action_failed'); }
  };

  const closePreview = async () => {
    if (busyRef.current) return;
    try {
      const pending = await readSharedScheduleImport();
      if (pending?.code === code) await clearSharedScheduleImport(pending.copyId);
      if (Platform.OS === 'web') navigation.push(fallbackRoute);
      else if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace(fallbackRoute);
    } catch { setSaveError('common.action_failed'); }
  };

  const openLegalDocument = async (documentType) => {
    setLegalLinkError(false);
    try { await Linking.openURL(getLegalDocumentBrowserUrl(documentType, lang)); }
    catch { setLegalLinkError(true); }
  };

  const saveButton = <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.save_copy', lang)}
    accessibilityState={{ disabled: saving || saved || !shared || (!!(user || guest) && isLoading), busy: saving }}
    disabled={saving || saved || !shared || (!!(user || guest) && isLoading)} onPress={saveCopy}
    style={[styles.saveButton, { backgroundColor: colors.accentColor, opacity: saving || !shared ? 0.6 : 1 }]}>
    <DownloadSimple size={20} color={colors.textOnAccent} accessible={false} />
    <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>{t(saving ? 'share.preparing' : 'share.save_copy', lang)}</Text>
  </TouchableOpacity>;
  const DetailCaret = detailsVisible ? CaretUp : CaretDown;

  return <View style={[styles.screen, { backgroundColor: colors.backgroundColor, paddingTop: insets.top }]}>
    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    <View style={[styles.topBar, { borderColor: colors.borderColor }]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.back_to_planit', lang)}
          disabled={saving} onPress={closePreview} style={styles.backButton}>
          <ArrowLeft size={20} color={colors.textColor2} accessible={false} />
          <PlanItWordmark fontSize={24} color={colors.textColor} isDark={colorScheme === 'dark'} />
        </TouchableOpacity>
        {desktop && saveButton}
      </View>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: colors.accentTextColor }]}>{t('share.read_only', lang)}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textColor }]}>{shared?.scheduleData.name || t('share.open_title', lang)}</Text>
        <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.preview_short', lang)}</Text>
      </View>
      {saveError && <Text accessibilityRole="alert" style={[styles.meta, { color: colors.textColor }]}>{t(saveError, lang)}</Text>}
      {errorKey ? <View style={styles.state}>
        <Text accessibilityRole="alert" style={[styles.meta, { color: colors.textColor }]}>{t(errorKey, lang)}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={[styles.button, { borderColor: colors.borderColor }]}>
          <Text style={{ color: colors.accentTextColor }}>{t('common.retry', lang)}</Text>
        </TouchableOpacity>
      </View> : !shared ? <View accessibilityRole="progressbar" accessibilityLabel={t('schedule.loading', lang)} style={styles.state}>
        <MorphingLoader size={58} />
      </View> : <>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: detailsVisible }} onPress={() => setDetailsVisible(value => !value)} style={styles.aboutButton}>
          <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.about_schedule', lang)}</Text>
          <DetailCaret size={16} color={colors.textColor2} accessible={false} />
        </TouchableOpacity>
        {detailsVisible && <View style={[styles.info, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}>
          <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.author', lang)}: {shared.ownerName}</Text>
          <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.available_until', lang, {
            date: new Intl.DateTimeFormat(getLocale(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(shared.expiresAt),
          })}</Text>
          <Text style={[styles.meta, { color: colors.textColor2 }]}>{t('share.snapshot_hint', lang)}</Text>
          {Platform.OS === 'web' && <TouchableOpacity accessibilityRole="link" href={'planit://share/' + encodeURIComponent(code)} style={styles.legalLink}>
            <Text style={{ color: colors.accentTextColor }}>{t('share.open_in_app', lang)}</Text>
          </TouchableOpacity>}
        </View>}
        <SharedSchedulePreview key={code} schedule={shared.scheduleData} lang={lang} themeColors={colors} />
      </>}
      <View style={[styles.legalLinks, { borderColor: colors.borderColor }]}>
        {['privacy', 'terms'].map(documentType => <TouchableOpacity key={documentType} accessibilityRole="link"
          {...(Platform.OS === 'web' ? { href: getLegalDocumentBrowserUrl(documentType, lang), hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }
            : { onPress: () => openLegalDocument(documentType) })} style={styles.legalLink}>
          <Text style={[styles.meta, { color: colors.textColor2 }]}>{t(documentType === 'privacy' ? 'settings.about_screen.privacy_policy' : 'settings.about_screen.terms_of_use', lang)}</Text>
        </TouchableOpacity>)}
      </View>
      {legalLinkError && <Text accessibilityRole="alert" style={[styles.meta, { color: colors.textColor }]}>{t('settings.about_screen.link_open_failed', lang)}</Text>}
    </ScrollView>
    {!desktop && <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>{saveButton}</View>}
    <SharedScheduleAccessSheet visible={accessVisible && !user && !guest} onClose={closeAccess} onContinue={continueAccess}
      needsAcceptance={needsAcceptance} busy={saving} errorText={saveError ? t(saveError, lang) : null}
      colors={colors} lang={lang} onOpenDocument={openLegalDocument} />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  header: { width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  content: { width: '100%', maxWidth: 1280, alignSelf: 'center', padding: 24, gap: 20 },
  heading: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '700', lineHeight: 38 },
  meta: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveButton: { minHeight: 50, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 15, fontWeight: '600' },
  aboutButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  info: { gap: 8, padding: 16, borderWidth: 1, borderRadius: 16 },
  state: { alignItems: 'center', paddingVertical: 40, gap: 20 },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  legalLink: { minHeight: 44, justifyContent: 'center', paddingVertical: 10 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12 },
});
