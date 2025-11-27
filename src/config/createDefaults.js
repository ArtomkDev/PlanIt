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