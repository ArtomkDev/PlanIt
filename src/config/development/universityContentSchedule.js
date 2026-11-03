import { generateId } from '../../utils/idGenerator';
import { buildLessonOccurrences, getLastMondayISODate, normalizeScheduleDate } from '../../utils/scheduleTime';
import { createTaskDraftFromOccurrence } from '../../utils/taskLessonLinking';

const courses = [
  {
    key: 'math', name: 'Вища математика', icon: 'math', teacher: 'Олена Коваль', room: '204',
    palette: 'Рубін', colors: ['#E00046', '#BF31B3'],
    note: 'Диференціальне та інтегральне числення. Конспект і розв’язання готуємо до практичної пари.',
    resource: ['Конспект · Інтегральне числення', 'https://univ.example/math'],
    tasks: [
      'Розв’язати інтеграли № 12–18. Порівняти метод підстановки та інтегрування частинами.',
      'Підготуватися до колоквіуму: границі, похідні та їх застосування.',
      'Дослідити функцію, знайти точки екстремуму й побудувати графік.',
    ],
  },
  {
    key: 'algorithms', name: 'Алгоритми та структури даних', icon: 'code', teacher: 'Андрій Мельник', room: '312',
    palette: 'Ультрафіолет', colors: ['#244ADB', '#8616CA'],
    note: 'Графи, дерева та складність алгоритмів. На практичну беремо ноутбук із готовими тестами.',
    resource: ['Алгоритми · Конспект лекцій', 'https://univ.example/algorithms'],
    tasks: [
      'Реалізувати пошук у ширину для графа з 8 вершинами. Додати тести та оцінити складність.',
      'Порівняти quicksort і merge sort на 10 000 елементів. Побудувати таблицю результатів.',
      'Підготувати бінарне дерево пошуку: вставка, пошук і видалення вузла.',
    ],
  },
  {
    key: 'database', name: 'Бази даних', icon: 'data', teacher: 'Ірина Бондар', room: '308',
    palette: 'Смарагд', colors: ['#00872D', '#007789'],
    note: 'Проєкт семестру — база даних університетської бібліотеки. Працюємо з реляційною СКБД.',
    resource: ['Довідник з мови SQL', 'https://univ.example/sql'],
    tasks: [
      'Спроєктувати ER-діаграму бібліотеки: книги, читачі та видачі. Перевірити зв’язки між таблицями.',
      'Написати 5 SQL-запитів із JOIN та GROUP BY для звіту бібліотеки.',
      'Нормалізувати таблиці до 3НФ і підготувати міграцію зі зв’язками та індексами.',
    ],
  },
  {
    key: 'software', name: 'Інженерія програмного забезпечення', icon: 'git_pull', teacher: 'Дмитро Шевченко', room: '301',
    palette: 'Фуксія', colors: ['#7A1DD0', '#CF1762'],
    note: 'Командний проєкт — застосунок для студентського кампусу. Демонстрація результатів наприкінці спринту.',
    resource: ['Контроль версій · Посібник', 'https://univ.example/version-control'],
    tasks: [
      'Описати 3 user stories для застосунку кампусу. Додати критерії приймання до кожної.',
      'Підготувати pull request: форма реєстрації, перевірка полів і тести.',
      'Оновити дошку спринту та підготувати коротку демонстрацію командного проєкту.',
    ],
  },
  {
    key: 'networks', name: 'Комп’ютерні мережі', icon: 'network', teacher: 'Максим Ткаченко', room: '405',
    palette: 'Лазур', colors: ['#056CA6', '#4245DC'],
    note: 'Мережа кампусу: адресація, маршрутизація та безпека. Схему й результати перевірок додаємо до звіту.',
    resource: ['Мережі · Лабораторні роботи', 'https://univ.example/networks'],
    tasks: [
      'Розділити мережу кампусу на 4 підмережі. Розрахувати маски й діапазони адрес.',
      'Налаштувати VLAN для бібліотеки та лабораторії. Перевірити з’єднання командою ping.',
      'Проаналізувати DNS-запит у Wireshark і додати схему обміну пакетами до звіту.',
    ],
  },
  {
    key: 'english', name: 'Професійна англійська', icon: 'lang', teacher: 'Софія Романенко', room: '216',
    palette: 'Захід сонця', colors: ['#C34800', '#B9257A'],
    note: 'English for IT: презентації, командна комунікація та технічна документація.',
    resource: ['Практика англійської · Вправи', 'https://univ.example/english'],
    tasks: [
      'Підготувати 3-хвилинну презентацію “My first tech project”. Додати 5 професійних термінів.',
      'Написати короткий README англійською: опис проєкту, встановлення та приклад використання.',
      'Опрацювати лексику “Teamwork & deadlines” і скласти 8 речень про командний проєкт.',
    ],
  },
  {
    key: 'design', name: 'Проєктування інтерфейсів', icon: 'art', teacher: 'Катерина Савчук', room: '410',
    palette: 'Полум’я', colors: ['#DF2C00', '#A16C00'],
    note: 'Мобільний сервіс для студентів: дослідження, прототип і перевірка доступності.',
    resource: ['Дизайн інтерфейсів · Кейси', 'https://univ.example/design'],
    tasks: [
      'Зібрати прототип екрана розкладу до п’ятниці. Підготувати світлу й темну теми.',
      'Перевірити контраст тексту та розміри кнопок у мобільному прототипі.',
      'Провести 3 короткі інтерв’ю зі студентами та виписати основні потреби.',
    ],
  },
];

const weekLessons = [
  [
    [['math', 'лекція'], ['algorithms', 'лекція'], ['database', 'лабораторна'], ['design', 'практична']],
    [['networks', 'лекція'], ['software', 'лекція'], ['english', 'практична'], ['algorithms', 'лабораторна']],
    [['database', 'лекція'], ['math', 'практична'], ['design', 'практична'], ['software', 'лабораторна']],
    [['algorithms', 'практична'], ['networks', 'лабораторна'], ['database', 'практична'], ['english', 'семінар']],
    [['software', 'практична'], ['design', 'семінар'], ['math', 'лекція'], ['networks', 'практична']],
  ],
  [
    [['algorithms', 'практична'], ['math', 'лекція'], ['design', 'практична'], ['database', 'лабораторна']],
    [['software', 'лекція'], ['networks', 'практична'], ['english', 'практична'], ['algorithms', 'лабораторна']],
    [['math', 'практична'], ['database', 'лекція'], ['software', 'лабораторна'], ['design', 'семінар']],
    [['networks', 'лабораторна'], ['algorithms', 'лекція'], ['database', 'практична'], ['english', 'семінар']],
    [['design', 'практична'], ['software', 'практична'], ['networks', 'лекція'], ['math', 'семінар']],
  ],
];

export function createUniversityContentSchedule(dateInput = new Date()) {
  const now = new Date(dateInput);
  const teachers = courses.map(course => ({ id: generateId(), name: course.teacher }));
  const links = courses.map(course => ({
    id: generateId(), name: course.resource[0], url: course.resource[1], type: 'website',
  }));
  const gradients = courses.map(course => ({
    id: generateId(), name: course.palette, type: 'linear', angle: 0,
    colors: course.colors.map((color, position) => ({ color, position })),
  }));
  const subjects = courses.map((course, index) => ({
    id: generateId(), name: course.name, icon: course.icon,
    color: course.colors[0], typeColor: 'gradient', colorGradient: gradients[index].id,
    teachers: [teachers[index].id], links: [links[index].id],
    room: course.room, building: 'Головний корпус', note: course.note,
  }));
  const subjectByKey = new Map(courses.map((course, index) => [course.key, subjects[index]]));
  const schedule = Array.from({ length: 7 }, () => ({ week1: [], week2: [] }));
  weekLessons.forEach((days, weekIndex) => {
    days.forEach((lessons, dayIndex) => {
      schedule[dayIndex][`week${weekIndex + 1}`] = lessons.map(([key, type], index) => ({
        subjectId: subjectByKey.get(key).id, type, timeMode: 'slot', slotNumber: index + 1,
        recurrence: { id: generateId(), mode: 'selected', weeks: [weekIndex + 1] },
      }));
    });
  });

  const result = {
    id: generateId(), name: 'Університет · КН-31', color: '#7C3AED',
    repeat: 2, starting_week: getLastMondayISODate(now),
    start_time: '08:30', duration: 80, slotDurations: [80, 80, 80, 80], breaks: [10, 20, 10],
    reminder: { enabled: false },
    subjects, teachers, links, gradients, schedule, tasks: [],
  };

  const today = normalizeScheduleDate(now);
  const from = new Date(today);
  from.setDate(from.getDate() - 7);
  const occurrences = buildLessonOccurrences(result, { from, horizonDays: 21, includePast: true });
  const taskLessons = [
    ...occurrences.filter(lesson => lesson.date < today).slice(-4),
    ...occurrences.filter(lesson => lesson.date >= today).slice(0, 12),
  ];
  const courseBySubjectId = new Map(subjects.map((subject, index) => [subject.id, courses[index]]));
  const taskCounts = new Map();
  result.tasks = taskLessons.map((lesson, index) => {
    const { subjectId, lessonRef, linkIds } = createTaskDraftFromOccurrence(result, lesson);
    const course = courseBySubjectId.get(subjectId);
    const taskIndex = taskCounts.get(subjectId) || 0;
    taskCounts.set(subjectId, taskIndex + 1);
    const timestamp = now.getTime() - index * 60000;
    return {
      id: generateId(), subjectId, lessonRef, links: linkIds,
      text: course.tasks[taskIndex % course.tasks.length],
      completed: lesson.date < today, createdAt: timestamp, updatedAt: timestamp,
    };
  });

  return result;
}
