import React, { forwardRef } from 'react';
import { TextInput } from 'react-native';
import useAppTheme from '../../hooks/useAppTheme';

export default forwardRef(function AppTextInput({ style, ...props }, ref) {
  const { colors, colorScheme } = useAppTheme();
  return <TextInput ref={ref}
    keyboardAppearance={colorScheme}
    placeholderTextColor={colors.textColor2}
    selectionColor={colors.accentColor + '66'}
    cursorColor={colors.accentColor}
    selectionHandleColor={colors.accentColor}
    {...props}
    style={[{ color: colors.textColor }, style]} />;
});
