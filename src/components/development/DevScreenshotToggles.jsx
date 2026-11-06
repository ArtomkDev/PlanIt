import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Hourglass, Megaphone } from 'phosphor-react-native';
import { useScheduleData } from '../../context/ScheduleProvider';
import { setScreenshotFlag, useScreenshotFlags } from '../../config/development/screenshotMode';
import SettingsRow from '../ui/SettingsKit/SettingsRow';
import AppSwitch from '../ui/AppSwitch';

const copy = {
  uk: {
    ads: { title: 'Показ реклами', description: 'Вимкни, щоб повністю прибрати верхній блок реклами' },
    lesson: { title: 'Активне заняття', description: 'Перше заняття кожного дня активне, до кінця завжди 28:09' },
    note: 'Лише для dev-збірки: зручно для скриншотів. У релізі цих перемикачів немає.',
  },
  en: {
    ads: { title: 'Show ads', description: 'Turn off to remove the top ad block completely' },
    lesson: { title: 'Active lesson', description: 'The first lesson of every day is active with 28:09 left' },
    note: 'Development builds only, handy for screenshots. Release builds do not have these switches.',
  },
};

// `on` maps a stored flag to the switch position.
const rows = [
  { key: 'ads', flag: 'adsHidden', icon: Megaphone, on: (value) => !value },
  { key: 'lesson', flag: 'activeLesson', icon: Hourglass, on: (value) => value },
];

export default function DevScreenshotToggles({ themeColors }) {
  const { lang } = useScheduleData();
  const flags = useScreenshotFlags();
  const text = copy[lang] || copy.en;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
      <Text style={[styles.badge, { color: themeColors.accentTextColor }]}>DEV</Text>
      {rows.map(({ key, flag, icon, on }) => {
        const checked = on(flags[flag]);
        const toggle = () => setScreenshotFlag(flag, !flags[flag]);
        return (
          <SettingsRow
            key={key}
            icon={icon}
            label={text[key].title}
            desc={text[key].description}
            onPress={toggle}
            showCaret={false}
            skipHaptic
            accessibilityRole="switch"
            accessibilityState={{ checked }}
            rightContentPointerEvents="none"
            rightContent={<AppSwitch value={checked} onValueChange={toggle} themeColors={themeColors} interactive={false} />}
            themeColors={themeColors}
          />
        );
      })}
      <Text style={[styles.note, { color: themeColors.textColor2 }]}>{text.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, marginBottom: 20, overflow: 'hidden' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 16, paddingTop: 12, letterSpacing: 1 },
  note: { fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 14 },
});
