import { useCallback } from "react";
import { generateId } from "../utils/idGenerator";

export default function useUniqueId() {
  const getUniqueId = useCallback(() => {
    return generateId();
  }, []);

  return getUniqueId;
}