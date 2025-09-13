// src/config/createDefaults.js
export function createDefaultTeacher(generateId) {
  return {
    id: generateId(),
    name: "Новий вчитель",
  };
}

export function createDefaultSubject(generateId) {
  return {
    id: generateId(),
    name: "Нова пара",
  };
}

export function createDefaultLink(generateId) {
  return {
    id: generateId(),
    name: "Нове посилання",
    url: "",
  };
}

export function createDefaultStatus(generateId) {
  return {
    id: generateId(),
    name: "Новий статус",
    color: "blue",
  };
}
