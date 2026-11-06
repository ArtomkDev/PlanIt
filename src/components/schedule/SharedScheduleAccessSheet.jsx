import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import BottomSheet, { SheetScrollView } from '../ui/BottomSheet';
import TermsCheckbox from '../privacy/TermsCheckbox';
import { t } from '../../utils/i18n';

export default function SharedScheduleAccessSheet({ visible, onClose, onContinue, needsAcceptance, busy, errorText, colors, lang, onOpenDocument }) {
  const [accepted, setAccepted] = useState(false);
  useEffect(() => { if (!visible) setAccepted(false); }, [visible]);
  const disabled = busy || (needsAcceptance && !accepted);
  const choices = [
    ['guest', 'auth.welcome.guest_btn'], ['signin', 'auth.signin.submit'], ['signup', 'auth.signup.title'],
  ];
  return <BottomSheet visible={visible} onClose={busy ? undefined : onClose} snapPoints={['64%', '90%']} maxWidth={520}
    closeOnBackdropPress={!busy} enablePanDownToClose={!busy} backgroundColor={colors.backgroundColor}
    accessibilityLabel={t('share.save_copy', lang)} closeAccessibilityLabel={t('common.close', lang)}>
    <SheetScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textColor }]}>{t('share.save_copy', lang)}</Text>
      <Text style={[styles.description, { color: colors.textColor2 }]}>{t('share.session_required', lang)}</Text>
      {needsAcceptance && <TermsCheckbox disabled={busy} acceptedTerms={accepted} onToggle={() => { if (!busy) setAccepted(value => !value); }}
        colors={colors} lang={lang} onOpenDocument={onOpenDocument} />}
      {!!errorText && <Text accessibilityRole="alert" style={[styles.description, { color: colors.textColor }]}>{errorText}</Text>}
      {choices.map(([mode, label], index) => <TouchableOpacity key={mode} accessibilityRole="button"
        disabled={disabled} accessibilityState={{ disabled, busy }} onPress={() => onContinue(mode, accepted)}
        style={[styles.button, { borderColor: colors.borderColor, opacity: disabled ? 0.45 : 1,
          backgroundColor: index === 0 ? colors.accentColor : colors.backgroundColor2 }]}>
        <Text style={[styles.buttonText, { color: index === 0 ? colors.textOnAccent : colors.textColor }]}>{t(busy ? 'share.preparing' : label, lang)}</Text>
      </TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button" onPress={onClose} disabled={busy} style={styles.button}>
        <Text style={{ color: colors.textColor2 }}>{t('share.back_to_preview', lang)}</Text>
      </TouchableOpacity>
    </SheetScrollView>
  </BottomSheet>;
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 23 },
  button: { minHeight: 50, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
