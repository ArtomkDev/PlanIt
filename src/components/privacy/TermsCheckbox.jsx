import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckSquare, Square } from 'phosphor-react-native';
import { t } from '../../utils/i18n';
import { triggerHaptic } from '../../utils/haptics';

const TermsCheckbox = ({ acceptedTerms, onToggle, error, colors, lang, onOpenDocument, disabled = false }) => {
  const toggleTerms = () => {
    if (disabled) return;
    triggerHaptic(acceptedTerms ? "toggleOff" : "toggleOn");
    onToggle();
  };

  const openDocument = (documentType) => {
    triggerHaptic("open");
    onOpenDocument?.(documentType);
  };

  return (
    <View>
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedTerms, disabled }}
          disabled={disabled}
          accessibilityLabel={t('auth.terms.accept_label', lang)}
          accessibilityHint={error}
          style={styles.checkboxButton}
          onPress={toggleTerms}
          activeOpacity={0.7}
        >
          {acceptedTerms ?
            <CheckSquare size={22} color={colors.accentColor} weight="fill" /> :
            <Square size={22} color={error ? '#ef4444' : colors.textColor2} weight={error ? "bold" : "regular"} />
          }
        </TouchableOpacity>
        <Text style={[styles.checkboxText, { color: colors.textColor2 }]}>
          <Text onPress={toggleTerms}>{t('auth.terms.agree_prefix', lang)}</Text>
          <Text accessibilityRole="link" style={{ color: colors.accentTextColor }} onPress={() => openDocument('privacy')}>
            {t('auth.terms.privacy_policy', lang)}
          </Text>
          <Text onPress={toggleTerms}>{t('auth.terms.and', lang)}</Text>
          <Text accessibilityRole="link" style={{ color: colors.accentTextColor }} onPress={() => openDocument('terms')}>
            {t('auth.terms.terms_conditions', lang)}
          </Text>
        </Text>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.fieldError, styles.termsError]}>{error}</Text>
      ) : null}
    </View>
  );
};

export default TermsCheckbox;
const styles = StyleSheet.create({
 checkboxContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
 checkboxButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
 checkboxText: { fontSize: 14, lineHeight: 21, flex: 1 },
 fieldError: { color: '#ef4444', fontSize: 13, marginTop: 6 },
 termsError: { marginLeft: 48 },
});
