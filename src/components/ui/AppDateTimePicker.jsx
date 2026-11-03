import React from 'react';
import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import useAppTheme from '../../hooks/useAppTheme';

export default function AppDateTimePicker(props) {
  const { colors, colorScheme } = useAppTheme();
  const themeProps = Platform.OS === 'android' ? {
    // AppCompat.DayNight does not supply the attributes required by Material3 pickers.
    design: 'default',
    positiveButton: { ...props.positiveButton, textColor: colors.accentColor },
    negativeButton: { ...props.negativeButton, textColor: colors.textColor2 },
  } : {
    themeVariant: colorScheme,
    textColor: colors.textColor,
    accentColor: colors.accentColor,
  };
  return <DateTimePicker {...props} {...themeProps} />;
}
