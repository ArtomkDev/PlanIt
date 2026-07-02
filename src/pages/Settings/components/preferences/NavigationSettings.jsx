import React from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { CalendarDots, Check, GearSix } from 'phosphor-react-native';
import SettingsScreenLayout from '../../../../layouts/SettingsScreenLayout';
import { useSchedule } from '../../../../context/ScheduleProvider';
import themes from '../../../../config/themes';
import { t } from '../../../../utils/i18n';
import { NAVIGATION_METRICS, NAVIGATION_STYLE_KEYS } from '../../../../navigation/navigationMetrics';

function NavigationPreview({ variant, selected, showLabels, themeColors, lang }) {
  const isIsland = variant === 'island';
  const isMaterial = variant === 'material';
  const isClassic = variant === 'classic';
  const metrics = NAVIGATION_METRICS[variant];
  const previewScale = 0.8;
  const previewBarHeight = Math.round(
    (showLabels ? metrics.heightWithLabels : metrics.heightIconsOnly) * previewScale
  );
  const previewRadius = Math.round(metrics.radius * previewScale);
  const previewSide = isClassic ? 0 : 10;
  const previewBottom = isClassic ? 0 : 6;
  const previewMaterialIndicatorHeight = isMaterial
    ? Math.round(metrics.indicatorHeight * previewScale)
    : 0;
  const previewMaterialIndicatorTop = isMaterial
    ? (showLabels
        ? Math.round(metrics.indicatorTopWithLabels * previewScale)
        : Math.round((previewBarHeight - previewMaterialIndicatorHeight) / 2))
    : 0;

  return (
    <View style={[styles.previewCanvas, { backgroundColor: themeColors.backgroundColor }]}>
      <View style={styles.previewContent}>
        <View style={[styles.previewLine, { backgroundColor: themeColors.borderColor, width: '58%' }]} />
        <View style={[styles.previewLine, { backgroundColor: themeColors.borderColor, width: '78%' }]} />
      </View>

      <View
        style={[
          styles.previewBar,
          {
            height: previewBarHeight,
            left: previewSide,
            right: previewSide,
            bottom: previewBottom,
            borderRadius: previewRadius,
            backgroundColor: themeColors.backgroundColor2,
            borderColor: themeColors.borderColor,
          },
          !isClassic && styles.previewFloatingBar,
        ]}
      >
        <View style={[
          styles.previewItem,
          isIsland && styles.previewActiveIsland,
          isIsland && {
            borderRadius: Math.round(metrics.indicatorRadius * previewScale),
            backgroundColor: themeColors.accentColor,
          },
        ]}>
          {isClassic && (
            <View
              style={[
                styles.previewClassicLine,
                {
                  width: Math.round(metrics.indicatorWidth * previewScale),
                  height: metrics.indicatorHeight,
                  borderRadius: metrics.indicatorRadius,
                  backgroundColor: themeColors.accentColor,
                },
              ]}
            />
          )}
          {isMaterial && (
            <View
              style={[
                styles.previewMaterialPill,
                {
                  width: Math.round(metrics.indicatorWidth * previewScale),
                  height: previewMaterialIndicatorHeight,
                  top: previewMaterialIndicatorTop,
                  borderRadius: Math.round(metrics.indicatorRadius * previewScale),
                  backgroundColor: themeColors.accentColorLight,
                },
              ]}
            />
          )}
          <CalendarDots size={17} color={isIsland ? '#fff' : themeColors.accentColor} weight="fill" />
          {showLabels && (
            <Text style={[styles.previewLabel, { color: isIsland ? '#fff' : themeColors.accentColor }]}>
              {t('common.schedule', lang)}
            </Text>
          )}
        </View>
        <View style={styles.previewItem}>
          <GearSix size={17} color={themeColors.textColor2} />
          {showLabels && (
            <Text style={[styles.previewLabel, { color: themeColors.textColor2 }]}>
              {t('common.settings', lang)}
            </Text>
          )}
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
    letterSpacing: -0.5,
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
    height: 82,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 5,
  },
  previewLine: {
    height: 4,
    borderRadius: 3,
    opacity: 0.7,
  },
  previewBar: {
    position: 'absolute',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: 6,
  },
  previewFloatingBar: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    position: 'relative',
  },
  previewActiveIsland: {
    marginVertical: 3,
    marginHorizontal: 4,
  },
  previewClassicLine: {
    position: 'absolute',
    top: 0,
  },
  previewMaterialPill: {
    position: 'absolute',
  },
  previewLabel: {
    fontSize: 8,
    fontWeight: '700',
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
