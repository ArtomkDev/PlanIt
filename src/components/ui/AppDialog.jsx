import React, { useEffect, useRef } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const DANGER_COLOR = "#FF3B30";

export default function AppDialog({ dialog, visible, themeColors, reduceMotion, onAction, onDismiss }) {
  const initialFocusRef = useRef(null);
  const actions = dialog?.actions || [];
  const stacked = actions.length > 2;
  const orderedActions = stacked
    ? [...actions.filter((action) => action.style !== "cancel"), ...actions.filter((action) => action.style === "cancel")]
    : actions;

  useEffect(() => {
    if (Platform.OS !== "web" || !visible || !dialog) return undefined;
    const frame = requestAnimationFrame(() => initialFocusRef.current?.focus?.());
    return () => cancelAnimationFrame(frame);
  }, [dialog, visible]);

  if (!dialog) return null;

  const initialFocusAction = actions.find((action) => action.style === "cancel") || actions[0];

  const getButtonColors = (style) => {
    if (style === "cancel") return { backgroundColor: themeColors.backgroundColor3, color: themeColors.textColor };
    if (style === "destructive") return { backgroundColor: DANGER_COLOR, color: "#FFFFFF" };
    if (style === "secondary") return { backgroundColor: themeColors.accentColor + "20", color: themeColors.accentTextColor };
    return { backgroundColor: themeColors.accentColor, color: themeColors.textOnAccent };
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onDismiss}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onDismiss}
          accessible={false}
          focusable={false}
          importantForAccessibility="no"
          testID="app-dialog-backdrop"
        />
        <View
          accessibilityViewIsModal
          role="alertdialog"
          aria-modal
          aria-label={dialog.title || dialog.message}
          style={[styles.card, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}
          testID="app-dialog"
        >
          {!!dialog.title && (
            <Text accessibilityRole="header" style={[styles.title, { color: themeColors.textColor }]}>
              {dialog.title}
            </Text>
          )}
          {!!dialog.message && (
            <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageContent} bounces={false}>
              <Text style={[styles.message, { color: themeColors.textColor2 }]}>{dialog.message}</Text>
            </ScrollView>
          )}
          <View style={stacked ? styles.actionsStacked : styles.actionsRow}>
            {orderedActions.map((action) => {
              const colors = getButtonColors(action.style);
              return (
                <Pressable
                  key={action.key}
                  ref={action === initialFocusAction ? initialFocusRef : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => onAction(action)}
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && styles.buttonInRow,
                    { backgroundColor: colors.backgroundColor, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: colors.color }]} numberOfLines={2}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "86%",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 25,
    marginBottom: 8,
  },
  messageScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  messageContent: {
    paddingBottom: 4,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  actionsStacked: {
    gap: 8,
    marginTop: 20,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonInRow: {
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
