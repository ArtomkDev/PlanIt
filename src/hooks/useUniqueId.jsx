// src/hooks/useUniqueId.js
import { useCallback } from "react";

export default function useUniqueId() {
  const generateId = useCallback(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  }, []);

  return generateId;
}
