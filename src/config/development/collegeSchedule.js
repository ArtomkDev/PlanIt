import { generateId } from '../../utils/idGenerator';
import { getLastMondayDate } from '../../utils/scheduleTime';

// Transcribed from the supplied 2026–2027 college timetable. The document does
// not define a cycle start; use the app's usual current-Monday default.
const subjects = [
  { key: 'database', name: 'Бази даних', teacher: 'Міронов Ю.Г.', icon: 'data', colors: ['#2563EB', '#4338CA'] },
  { key: 'theory', name: 'Теорія ігор та прийняття рішень (Дослідження операції)', teacher: 'Талапов Т.К.', icon: 'strategy', colors: ['#7C3AED', '#A21CAF'] },
  { key: 'architecture', name: "Архітектура комп'ютера та комп'ютерних мереж", teacher: 'Зубко Р.А.', icon: 'cpu', colors: ['#B45309', '#C2410C'] },
  { key: 'os', name: 'Операційні системи', teacher: 'Храпачевський І.В.', icon: 'terminal', colors: ['#047857', '#0F766E'] },
  { key: 'english', name: 'Іноземна мова (за професійним спрямуванням)', teacher: 'Калинюк Н.В.', icon: 'lang', colors: ['#BE185D', '#7E22CE'] },
  { key: 'iot', name: 'Технологія інтернет речей', teacher: 'Дуднік А.С.', icon: 'network', colors: ['#0E7490', '#1D4ED8'] },
  { key: 'resistance', name: 'Основи національного спротиву', icon: 'target', colors: ['#3F6212', '#166534'] },
];

const meetings = {
  database: ['Бази даних · Zoom', 'https://us04web.zoom.us/j/6635209883?pwd=K0NCS0hrZnI4d3U1RExUWlVTbVNQQT09', 'Meeting ID: 663 520 9883\nPasscode: 72ivtn'],
  theory: ['Теорія ігор · Zoom', 'https://us02web.zoom.us/j/8748489354?pwd=QM81BJDSjdFfVEMUXuuENKiiyeqNwJ.1', ''],
  architecture: ['Архітектура · Zoom', 'https://us04web.zoom.us/j/8246476831?pwd=UHJUU3ZDU1lhNmhSRjN2dFJjU3dYUT09', 'Meeting ID: 824 647 6831\nКод доступу: 123'],
  os: ['Операційні системи · Zoom', 'https://us05web.zoom.us/j/86136381532?pwd=cM3H6pqn8TWCPyu6UOb84b5K9TLsjZ.1', 'Meeting ID: 861 3638 1532\nPasscode: 8J8GBr'],
  english: ['Іноземна мова · Zoom', 'https://us05web.zoom.us/j/87045316055?pwd=Fvxlh8ody2uUxWpojINmb5M5E059hm.1', ''],
  iot: ['Технологія інтернет речей · Zoom', 'https://us04web.zoom.us/j/73884324105?pwd=BA0vpQCkrq9qBZNXM52pJa7AznWkpK.1', 'Meeting ID: 738 8432 4105\nPasscode: dg0mqF'],
  resistance: ['Основи національного спротиву · лекції · Zoom', 'https://us02web.zoom.us/j/82151409815?pwd=6vdKe4LClIdip1OT9HxdWh4zKnEigw.1', 'Meeting ID: 821 5140 9815\nPasscode: 306154'],
  resistancePractice: ['Основи національного спротиву · практика · Zoom', 'https://nubip-edu-ua.zoom.us/j/9907610585?pwd=eXrKOMhAhPm7VvwowmHRFEIOjL230s.1', ''],
};

// [day, slot, subject, type, weeks, meeting, note, teacher override]
const lessons = [
  [1, 1, 'database', 'лекція'],
  [1, 2, 'database', 'практична'],
  [1, 3, 'architecture', 'практична', [2]],
  [1, 4, 'architecture', 'лекція'],
  [2, 1, 'theory', 'лекція'],
  [2, 2, 'theory', 'практична'],
  [2, 3, 'os', 'практична', [1]],
  [2, 4, 'english', 'практична', undefined, undefined, 'Потік С7'],
  [3, 2, 'iot', 'відпрацювання пропущених занять', undefined, undefined, 'пари проводитимуться тільки 01.10, 07.10, 14.10, 21.10'],
  [3, 4, 'os', 'лекція'],
  [4, 3, 'iot', 'лекція'],
  [4, 4, 'iot', 'практична'],
  [5, 1, 'resistance', 'лекція'],
  [5, 2, 'resistance', 'лекція'],
  [5, 4, 'resistance', 'практична', undefined, 'resistancePractice', 'потік ОНС14\nз 17.10.2026', 'Яфонкін Анатолій Олексійович'],
];

export function createCollegeTestSchedule() {
  const monday = getLastMondayDate();
  const teacherNames = [...new Set([
    ...subjects.map(({ teacher }) => teacher).filter(Boolean),
    'Яфонкін Анатолій Олексійович',
  ])];
  const teachers = teacherNames.map(name => ({ id: generateId(), name }));
  const teacherId = name => teachers.find(teacher => teacher.name === name)?.id;
  const links = Object.entries(meetings).map(([key, [name, url]]) => ({
    id: generateId(), key, name, url, type: 'meeting',
  }));
  const linkId = key => links.find(link => link.key === key).id;
  const gradients = subjects.map(({ name, colors }) => ({
    id: generateId(), name, type: 'linear', angle: 135,
    colors: [{ color: colors[0], position: 0 }, { color: colors[1], position: 1 }],
  }));
  const scheduleSubjects = subjects.map(({ key, name, teacher, icon, colors }, index) => ({
    id: generateId(), key, name, icon, color: colors[0], typeColor: 'gradient', colorGradient: gradients[index].id,
    ...(teacher ? { teachers: [teacherId(teacher)] } : {}),
    links: [linkId(key)],
    ...(meetings[key][2] ? { note: meetings[key][2] } : {}),
  }));
  const schedule = Array.from({ length: 7 }, () => ({ week1: [], week2: [] }));

  for (const [day, slotNumber, key, type, weeks = [1, 2], meeting = key, note, teacher] of lessons) {
    const subjectId = scheduleSubjects.find(subject => subject.key === key).id;
    const recurrenceId = generateId();
    for (const week of weeks) {
      schedule[day][`week${week}`].push({
        subjectId, type, timeMode: 'slot', slotNumber,
        recurrence: { id: recurrenceId, mode: weeks.length === 2 ? 'all' : 'selected', weeks: [...weeks] },
        ...(meeting !== key ? { links: [linkId(meeting)] } : {}),
        ...(note || meeting !== key ? { note: [note, meetings[meeting][2]].filter(Boolean).join('\n\n') } : {}),
        ...(teacher ? { teachers: [teacherId(teacher)] } : {}),
      });
    }
  }

  return {
    id: generateId(),
    name: '[DEV] ІПЗ-23-фмб-ict, ІПЗ-24.2-1фмб · 2026–2027 · 1 семестр, 1 модуль',
    color: '#06B6D4',
    repeat: 2,
    starting_week: new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())).toISOString(),
    start_time: '08:30',
    duration: 80,
    slotDurations: [80, 80, 80, 80, 80, 80],
    breaks: [10, 20, 10, 10, 10, 0],
    subjects: scheduleSubjects.map(({ key, ...subject }) => subject),
    teachers,
    links: links.map(({ key, ...link }) => link),
    gradients,
    tasks: [],
    schedule,
  };
}
