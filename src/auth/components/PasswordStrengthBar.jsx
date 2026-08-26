import React from 'react';
import { StyleSheet, View } from 'react-native';

import { getPasswordStrength } from '../passwordPolicy';

export default function PasswordStrengthBar({ password, isDark }) {
  if (!password) return null;

  const strength = getPasswordStrength(password);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            width: strength.width,
            backgroundColor: strength.color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
});
