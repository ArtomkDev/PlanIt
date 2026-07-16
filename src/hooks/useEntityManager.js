import { useCallback } from "react";
import { useScheduleActions } from "../context/ScheduleProvider";
import { createDefaultTeacher, createDefaultSubject, createDefaultLink, createDefaultGradient } from "../config/createDefaults";
import useUniqueId from "./useUniqueId";

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
    setScheduleDraft((prev) => {
      const next = { ...prev };
      
      if (next[key]) {
        next[key] = next[key].filter(item => item.id !== idToRemove);
      }

      if (next.schedule) {
        next.schedule = next.schedule.map(day => {
          if (!day) return day;
          const newDay = { ...day };
          Object.keys(newDay).forEach(weekKey => {
            if (Array.isArray(newDay[weekKey])) {
              newDay[weekKey] = newDay[weekKey].map(lesson => {
                if (!lesson) return lesson;
                const newLesson = { ...lesson };

                if (key === 'subjects' && newLesson.subjectId === idToRemove) {
                  return null; 
                }
                if (key === 'teachers' && newLesson.teachers) {
                  newLesson.teachers = newLesson.teachers.filter(tid => tid !== idToRemove);
                  if (newLesson.teachers.length === 0) delete newLesson.teachers;
                }
                if (key === 'links' && newLesson.links) {
                  newLesson.links = newLesson.links.filter(lid => lid !== idToRemove);
                  if (newLesson.links.length === 0) delete newLesson.links;
                }
                return newLesson;
              });
            }
          });
          return newDay;
        });
      }

      if (next.subjects) {
        next.subjects = next.subjects.map(subj => {
          const newSubj = { ...subj };
          if (key === 'teachers' && newSubj.teachers) {
            newSubj.teachers = newSubj.teachers.filter(tid => tid !== idToRemove);
          }
          if (key === 'links' && newSubj.links) {
            newSubj.links = newSubj.links.filter(lid => lid !== idToRemove);
          }
          if (key === 'gradients' && newSubj.colorGradient === idToRemove) {
            newSubj.colorGradient = null;
          }
          return newSubj;
        });
      }

      if (Array.isArray(next.tasks)) {
        if (key === 'subjects') {
          next.tasks = next.tasks.map(task => {
            if (!task || task.subjectId !== idToRemove) return task;
            return { ...task, subjectId: null };
          });
        } else if (key === 'links') {
          next.tasks = next.tasks.map(task => {
            if (!task || !Array.isArray(task.links)) return task;
            const nextLinks = task.links.filter(lid => lid !== idToRemove);
            return nextLinks.length > 0
              ? { ...task, links: nextLinks }
              : { ...task, links: [] };
          });
        }
      }

      return next;
    });
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
