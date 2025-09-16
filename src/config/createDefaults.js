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
    gradient: { type: "linear", angle: 90, colors: ["red"] }
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

export function createDefaultGradient(generateId) {
  return {
    id: generateId(),
    type: "linear",         // одразу є тип
    angle: 90,              // базовий кут
    colors: ["#ff0000", "#0000ff"], // дефолтні кольори
  };
}
