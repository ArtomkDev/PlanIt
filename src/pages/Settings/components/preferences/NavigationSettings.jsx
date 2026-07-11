import React from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDots, Check, GearSix } from 'phosphor-react-native';
import SettingsScreenLayout from '../../../../layouts/SettingsScreenLayout';
import { useSchedule } from '../../../../context/ScheduleProvider';
import themes from '../../../../config/themes';
import { t } from '../../../../utils/i18n';
import { NAVIGATION_METRICS, NAVIGATION_STYLE_KEYS } from '../../../../navigation/navigationMetrics';

const hexToRgba = (color, opacity) => {
  if (typeof color !== 'string' || !color.startsWith('#')) {
    return color;
  }

  const hex = color.replace('#', '');
  const normalized = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex.slice(0, 6);
  const intValue = Number.parseInt(normalized, 16);

  if (Number.isNaN(intValue)) {
    return color;
  }

  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const PREVIEW_VARIANTS = {
  classic: {
    barSide: 0,
    barBottom: 0,
    barRadius: 0,
    getIndicatorStyle: ({ metrics, themeColors, scale }) => ({
      width: Math.round(metrics.indicator.width * scale),
      height: Math.max(2, Math.round(metrics.indicator.height * scale)),
      borderRadius: metrics.indicator.radius,
      backgroundColor: themeColors.accentColor,
      top: 0,
    }),
    activeIconColor: ({ themeColors }) => themeColors.accentColor,
    activeLabelColor: ({ themeColors }) => themeColors.accentColor,
  },
  floating: {
    barSide: 16,
    barBottom: 8,
    barRadius: 22,
    getIndicatorStyle: ({ metrics, showLabels, themeColors, scale }) => {
      const height = Math.round(
        (showLabels ? metrics.indicator.heightWithLabels : metrics.indicator.heightIconsOnly) * scale
      );

      return {
        width: metrics.indicator.width,
        height,
        borderRadius: Math.round(metrics.indicator.radius * scale),
        backgroundColor: hexToRgba(themeColors.accentColor, 0.22),
        top: '50%',
        transform: [{ translateY: -height / 2 }],
      };
    },
    activeIconColor: ({ themeColors }) => themeColors.accentColor,
    activeLabelColor: ({ themeColors }) => themeColors.accentColor,
  },
  dot: {
    barSide: 0,
    barBottom: 0,
    barRadius: 0,
    getIndicatorStyle: ({ metrics, showLabels, themeColors, scale }) => ({
      width: Math.round(metrics.indicator.size * scale),
      height: Math.round(metrics.indicator.size * scale),
      borderRadius: Math.round(metrics.indicator.radius * scale),
      backgroundColor: themeColors.accentColor,
      top: Math.round((showLabels ? metrics.indicator.topWithLabels : metrics.indicator.topIconsOnly) * scale),
    }),
    activeIconColor: ({ themeColors }) => themeColors.accentColor,
    activeLabelColor: ({ themeColors }) => themeColors.accentColor,
  },
};

function NavigationPreview({ variant, selected, showLabels, themeColors, lang }) {
  const metrics = NAVIGATION_METRICS[variant] || NAVIGATION_METRICS.classic;
  const preview = PREVIEW_VARIANTS[variant] || PREVIEW_VARIANTS.classic;
  const scale = 0.78;
  const previewBarHeight = Math.round(
    (showLabels ? metrics.heightWithLabels : metrics.heightIconsOnly) * scale
  );
  const previewRadius = preview.barRadius || Math.round(metrics.radius * scale);
  const surfaceColor = hexToRgba(themeColors.backgroundColor2, 0.92);
  const activeIconColor = preview.activeIconColor({ themeColors });
  const activeLabelColor = preview.activeLabelColor({ themeColors });

  return (
    <View style={[styles.previewCanvas, { backgroundColor: themeColors.backgroundColor }]}>
      <View style={styles.previewContent}>
        <View style={[styles.previewMiniCard, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
          <View style={[styles.previewLine, { backgroundColor: themeColors.borderColor, width: '52%' }]} />
          <View style={[styles.previewLine, { backgroundColor: themeColors.borderColor, width: '72%' }]} />
        </View>
      </View>

      <View
        style={[
          styles.previewBarShadow,
          variant === 'floating' && styles.previewFloatingShadow,
          {
            height: previewBarHeight,
            left: preview.barSide,
            right: preview.barSide,
            bottom: preview.barBottom,
            borderRadius: previewRadius,
            backgroundColor: surfaceColor,
          },
        ]}
      >
        <View
          style={[
            styles.previewBar,
            {
              borderRadius: previewRadius,
              backgroundColor: surfaceColor,
              borderColor: themeColors.borderColor,
            },
            variant === 'floating' ? styles.previewFloatingBar : styles.previewAttachedBar,
          ]}
        >
          <View style={styles.previewItem}>
            <View
              style={[
                styles.previewIndicator,
                preview.getIndicatorStyle({ metrics, showLabels, themeColors, scale }),
              ]}
            />
            <CalendarDots size={17} color={activeIconColor} weight="fill" />
            {showLabels && (
              <Text numberOfLines={1} style={[styles.previewLabel, { color: activeLabelColor }]}>
                {t('common.schedule', lang)}
              </Text>
            )}
          </View>
          <View style={styles.previewItem}>
            <GearSix size={17} color={themeColors.textColor2} />
            {showLabels && (
              <Text numberOfLines={1} style={[styles.previewLabel, { color: themeColors.textColor2 }]}>
                {t('common.settings', lang)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {selected && (
        <View style={[styles.selectedBadge, { backgroundColor: themeColors.accentColor }]}>
          <Check size={13} color="#fff" weight="bold" />
        </View>
      )}
    </View>
  );
}

export default function NavigationSettings() {
  const { global, setGlobalDraft, lang } = useSchedule();
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const selectedStyle = NAVIGATION_STYLE_KEYS.includes(global?.navigationStyle)
    ? global.navigationStyle
    : 'classic';
  const showLabels = global?.navigationLabels ?? true;
  const animationsEnabled = global?.navigationAnimations ?? true;

  const updatePreference = (patch) => {
    setGlobalDraft((previous) => ({ ...previous, ...patch }));
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <View style={styles.intro}>
          <Text style={[styles.introTitle, { color: themeColors.textColor }]}>
            {t('settings.navigation_screen.title', lang)}
          </Text>
          <Text style={[styles.introText, { color: themeColors.textColor2 }]}>
            {t('settings.navigation_screen.description', lang)}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>
          {t('settings.navigation_screen.style_title', lang).toUpperCase()}
        </Text>

        <View style={styles.cards}>
          {NAVIGATION_STYLE_KEYS.map((variant) => {
            const selected = selectedStyle === variant;
            return (
              <TouchableOpacity
                key={variant}
                testID={`navigation-style-${variant}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t(`settings.navigation_screen.styles.${variant}.title`, lang)}
                activeOpacity={0.78}
                onPress={() => updatePreference({ navigationStyle: variant })}
                style={[
                  styles.card,
                  { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor },
                  selected && { borderColor: themeColors.accentColor, borderWidth: 2 },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: themeColors.textColor }]}>
                      {t(`settings.navigation_screen.styles.${variant}.title`, lang)}
                    </Text>
                    <Text style={[styles.cardDescription, { color: themeColors.textColor2 }]}>
                      {t(`settings.navigation_screen.styles.${variant}.desc`, lang)}
                    </Text>
                  </View>
                </View>

                <NavigationPreview
                  variant={variant}
                  selected={selected}
                  showLabels={showLabels}
                  themeColors={themeColors}
                  lang={lang}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, styles.behaviorTitle, { color: themeColors.textColor2 }]}>
          {t('settings.navigation_screen.behavior_title', lang).toUpperCase()}
        </Text>

        <View style={[styles.options, { backgroundColor: themeColors.backgroundColor2 }]}>
          <View style={styles.optionRow}>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: themeColors.textColor }]}>
                {t('settings.navigation_screen.labels_title', lang)}
              </Text>
              <Text style={[styles.optionDescription, { color: themeColors.textColor2 }]}>
                {t('settings.navigation_screen.labels_desc', lang)}
              </Text>
            </View>
            <Switch
              testID="navigation-labels-switch"
              accessibilityLabel={t('settings.navigation_screen.labels_title', lang)}
              value={showLabels}
              onValueChange={(value) => updatePreference({ navigationLabels: value })}
              trackColor={{ false: themeColors.backgroundColor3, true: themeColors.accentColor }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />

          <View style={styles.optionRow}>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: themeColors.textColor }]}>
                {t('settings.navigation_screen.animations_title', lang)}
              </Text>
              <Text style={[styles.optionDescription, { color: themeColors.textColor2 }]}>
                {t('settings.navigation_screen.animations_desc', lang)}
              </Text>
            </View>
            <Switch
              testID="navigation-animations-switch"
              accessibilityLabel={t('settings.navigation_screen.animations_title', lang)}
              value={animationsEnabled}
              onValueChange={(value) => updatePreference({ navigationAnimations: value })}
              trackColor={{ false: themeColors.backgroundColor3, true: themeColors.accentColor }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={[styles.note, { color: themeColors.textColor2 }]}>
          {t('settings.navigation_screen.sync_note', lang)}
        </Text>
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  intro: {
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 6,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 8,
    marginLeft: 4,
  },
  cards: {
    gap: 10,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardDescription: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  previewCanvas: {
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  previewMiniCard: {
    width: '72%',
    height: 30,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 5,
  },
  previewLine: {
    height: 4,
    borderRadius: 3,
    opacity: 0.75,
  },
  previewBarShadow: {
    position: 'absolute',
  },
  previewFloatingShadow: {
    ...Platform.select({
      web: { boxShadow: '0 8px 20px rgba(0,0,0,0.14)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 8,
      },
    }),
  },
  previewBar: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    paddingHorizontal: 6,
  },
  previewAttachedBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewFloatingBar: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    position: 'relative',
  },
  previewIndicator: {
    position: 'absolute',
    alignSelf: 'center',
  },
  previewLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0,
    maxWidth: 85,
  },
  selectedBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  behaviorTitle: {
    marginTop: 20,
  },
  options: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 74,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  optionDescription: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
  },
});