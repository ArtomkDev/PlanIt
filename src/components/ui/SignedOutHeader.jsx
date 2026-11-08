import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import SignedOutPreferenceButtons from './SignedOutPreferenceButtons';

// Shared by the shared-schedule preview and the auth screens so the language and theme buttons
// stay in the same place when a visitor moves between them.
export default function SignedOutHeader({ children, actions, style }) {
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.header, { paddingHorizontal: width < 640 ? 16 : 24 }, style]}>
      <View style={styles.start}>{children}</View>
      <View style={styles.actions}>
        {actions}
        <SignedOutPreferenceButtons />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%', maxWidth: 1280, height: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  start: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
