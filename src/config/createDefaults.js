import { t } from '../utils/i18n';

export function createDefaultTeacher(generateId, lang = 'en') {
  return {
    id: generateId(),
    name: t("schedule.lesson_editor.new_teacher", lang),
  };
}

export function createDefaultSubject(generateId, lang = 'en') {
  return {
    id: generateId(),
    name: t("schedule.lesson_editor.new_subject", lang),
  };
}

export function createDefaultLink(generateId, lang = 'en') {
  return {
    id: generateId(),
    name: t("schedule.lesson_editor.new_link", lang),
    url: "",
  };
}

export function createDefaultGradient(generateId) {
  return {
    id: generateId(),
    type: "linear",         // одразу є тип
    angle: 125,              // базовий кут
    colors: [
	      { color: "#4800bdff", position: 0 },
	      { color: "#11d3a9ff", position: 1 }
	  ]
  };
}
