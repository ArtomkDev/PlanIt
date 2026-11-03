import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import AppDialog from "../components/ui/AppDialog";
import themes from "../config/themes";
import useReducedMotionPreference from "../hooks/useReducedMotionPreference";
import { t } from "../utils/i18n";
import { useScheduleData } from "./ScheduleProvider";

const AppDialogContext = createContext(null);
const AppDialogVisibilityContext = createContext(false);

const getDialogKey = ({ title, message, actions }) => JSON.stringify([
  title, message, actions.map((action) => [action.label, action.style]),
]);

export function AppDialogProvider({ children }) {
  const { global, lang } = useScheduleData();
  const systemScheme = useColorScheme();
  const reduceMotion = useReducedMotionPreference();
  const [queue, setQueue] = useState([]);
  const queueRef = useRef([]);
  const lastDialogRef = useRef(null);
  const nextIdRef = useRef(0);
  const langRef = useRef(lang);
  langRef.current = lang;

  const [setting = systemScheme || "light", accent = "blue"] = global?.theme || [];
  const mode = setting === "system" ? systemScheme || "light" : setting;
  const themeColors = themes.getColors(mode, accent);

  const updateQueue = useCallback((next) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const present = useCallback(({ title, message, actions, dismissValue }) => {
    const dialog = { title, message, actions, dismissValue };
    const key = getDialogKey(dialog);
    const duplicate = queueRef.current.find((entry) => entry.key === key);
    if (duplicate) return duplicate.promise;

    const entry = { ...dialog, key, id: ++nextIdRef.current };
    entry.promise = new Promise((resolve) => { entry.resolve = resolve; });
    updateQueue([...queueRef.current, entry]);
    return entry.promise;
  }, [updateQueue]);

  const close = useCallback((id, value) => {
    const [current, ...rest] = queueRef.current;
    if (!current || current.id !== id) return;
    updateQueue(rest);
    current.resolve(value);
  }, [updateQueue]);

  const alert = useCallback(({ title, message, buttonLabel }) => present({
    title,
    message,
    actions: [{ key: "ok", label: buttonLabel || t("common.ok", langRef.current), style: "default", value: undefined }],
    dismissValue: undefined,
  }), [present]);

  const confirm = useCallback(({ title, message, confirmLabel, cancelLabel, destructive = false }) => present({
    title,
    message,
    actions: [
      { key: "cancel", label: cancelLabel || t("common.cancel", langRef.current), style: "cancel", value: false },
      { key: "confirm", label: confirmLabel, style: destructive ? "destructive" : "default", value: true },
    ],
    dismissValue: false,
  }), [present]);

  const choose = useCallback(({ title, message, options, cancelLabel }) => present({
    title,
    message,
    actions: [
      { key: "cancel", label: cancelLabel || t("common.cancel", langRef.current), style: "cancel", value: null },
      ...options.map((option, index) => ({
        key: `option-${index}`,
        label: option.label,
        style: option.destructive ? "destructive" : "secondary",
        value: option.value,
      })),
    ],
    dismissValue: null,
  }), [present]);

  const value = useMemo(() => ({ alert, confirm, choose }), [alert, confirm, choose]);
  const currentDialog = queue[0] || null;
  if (currentDialog) lastDialogRef.current = currentDialog;

  return (
    <AppDialogContext.Provider value={value}>
      <AppDialogVisibilityContext.Provider value={!!currentDialog}>
        {children}
        <AppDialog
          dialog={currentDialog || lastDialogRef.current}
          visible={!!currentDialog}
          themeColors={themeColors}
          reduceMotion={reduceMotion}
          onAction={(action) => close(currentDialog?.id, action.value)}
          onDismiss={() => close(currentDialog?.id, currentDialog?.dismissValue)}
        />
      </AppDialogVisibilityContext.Provider>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) throw new Error("useAppDialog requires AppDialogProvider");
  return context;
}

export const useIsAppDialogVisible = () => useContext(AppDialogVisibilityContext);
