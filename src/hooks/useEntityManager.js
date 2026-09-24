import { useCallback } from "react";
import { useScheduleActions, useScheduleData } from "../context/ScheduleProvider";
import { createDefaultTeacher, createDefaultSubject, createDefaultLink, createDefaultGradient } from "../config/createDefaults";
import useUniqueId from "./useUniqueId";
import { removeScheduleEntity } from "../utils/scheduleDeletion";

export default function useEntityManager() {
  const { setScheduleDraft } = useScheduleActions();
  const generateId = useUniqueId();
  const { lang } = useScheduleData();

  const addItem = useCallback((key, factory) => {
    const newItem = factory(generateId, lang);
    setScheduleDraft((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newItem],
    }));
    return newItem;
  }, [generateId, setScheduleDraft, lang]);

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
