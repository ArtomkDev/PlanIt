// src/hooks/useUniqueId.js
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import 'react-native-get-random-values';

export default function useUniqueId() {
  const generateId = useCallback(() => {
    try {
      return uuidv4();
    } catch (error) {
      console.warn("⚠️ Не вдалося згенерувати унікальний ID:", error);
      
      return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    }
  }, []);

  return generateId;
}
