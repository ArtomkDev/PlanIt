import { useCallback } from "react";
import { useScheduleActions } from "../context/ScheduleProvider";
import { createDefaultTeacher, createDefaultSubject, createDefaultLink, createDefaultGradient } from "../config/createDefaults";
import useUniqueId from "./useUniqueId";
import { removeScheduleEntity } from "../utils/scheduleDeletion";

export default function useEntityManager() {
  const { setScheduleDraft } = useScheduleActions();
  const generateId = useUniqueId();

  const addItem = useCallback((key, factory) => {
    const newItem = factory(generateId);
    setScheduleDraft((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newItem],
    }));
    return newItem;
  }, [generateId, setScheduleDraft]);

  const removeItem = useCallback((key, idToRemove) => {
    setScheduleDraft((prev) => removeScheduleEntity(prev, key, idToRemove));
  }, [setScheduleDraft]);

  return {
    addTeacher: () => addItem("teachers", createDefaultTeacher),
    addSubject: () => addItem("subjects", createDefaultSubject),
    addLink: () => addItem("links", createDefaultLink),
    addGradient: () => addItem("gradients", createDefaultGradient),
    removeTeacher: (id) => removeItem("teachers", id),
    removeSubject: (id) => removeItem("subjects", id),
    removeLink: (id) => removeItem("links", id),
    removeGradient: (id) => removeItem("gradients", id),
  };
}
