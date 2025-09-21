import { useCallback } from "react";
import { useSchedule } from "../context/ScheduleProvider";
import { createDefaultTeacher, createDefaultSubject, createDefaultLink, createDefaultStatus, createDefaultGradient } from "../config/createDefaults";
import useUniqueId from "./useUniqueId";

export default function useEntityManager() {
  const { setScheduleDraft } = useSchedule();
  const generateId = useUniqueId();

  const addItem = useCallback((key, factory) => {
    const newItem = factory(generateId);
    setScheduleDraft((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newItem],
    }));
    return newItem;
  }, [generateId, setScheduleDraft]);

  return {
    addTeacher: () => addItem("teachers", createDefaultTeacher),
    addSubject: () => addItem("subjects", createDefaultSubject),
    addLink: () => addItem("links", createDefaultLink),
    addStatus: () => addItem("statuses", createDefaultStatus),
    addGradient: () => addItem("gradients", createDefaultGradient),
  };
}
