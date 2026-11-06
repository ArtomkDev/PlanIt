import { generateId } from '../../utils/idGenerator';
import { buildLessonOccurrences, getLastMondayISODate, normalizeScheduleDate } from '../../utils/scheduleTime';
import { createTaskDraftFromOccurrence } from '../../utils/taskLessonLinking';

const courses = [
  {
    key: 'math', name: 'Математика', icon: 'math', teacher: 'Олена Коваль', room: '204',
    palette: 'Індиго', colors: ['#244ADB', '#8616CA'],
    note: 'Функції, рівняння та геометрія. На практичне заняття беремо зошит у клітинку й лінійку.',
    resource: ['Математика · Збірник вправ', 'https://study.example/math'],
    tasks: [
      'Розв’язати рівняння № 12–18. Записати хід розв’язання та перевірити отримані відповіді.',
      'Побудувати графіки трьох функцій. Позначити точки перетину з осями координат.',
      'Розв’язати п’ять задач на відсотки. Пояснити, як ці обчислення можна використати в побуті.',
    ],
  },
  {
    key: 'english', name: 'Англійська мова', icon: 'lang', teacher: 'Софія Романенко', room: '216',
    palette: 'Захід сонця', colors: ['#C34800', '#B9257A'],
    note: 'Повсякденне спілкування, читання та розмовна практика. Нові слова записуємо з прикладами.',
    resource: ['Англійська мова · Вправи', 'https://study.example/english'],
    tasks: [
      'Написати короткий текст “A place I would like to visit”. Використати вісім нових слів.',
      'Прочитати оповідання та підготувати п’ять запитань до нього для обговорення в групі.',
      'Підготувати діалог “Planning a weekend”. Потренувати вимову й уживання майбутнього часу.',
    ],
  },
  {
    key: 'literature', name: 'Література', icon: 'open_book', teacher: 'Андрій Мельник', room: '212',
    palette: 'Рубін', colors: ['#E00046', '#BF31B3'],
    note: 'Читаємо малу прозу та поезію, обговорюємо образи й характери. Цікаві цитати зберігаємо в читацькому щоденнику.',
    resource: ['Література · Читацький щоденник', 'https://study.example/literature'],
    tasks: [
      'Прочитати оповідання до кінця. Виписати три цитати, які найкраще розкривають головного героя.',
      'Написати відгук на улюблену книжку: тема, враження та кому її варто порадити.',
      'Обрати вірш для виразного читання. Знайти в ньому епітети й метафори та пояснити їхню роль.',
    ],
  },
  {
    key: 'biology', name: 'Біологія', icon: 'micro', teacher: 'Ірина Бондар', room: '308',
    palette: 'Смарагд', colors: ['#00872D', '#007789'],
    note: 'Клітини, рослини та екосистеми. Спостереження й схематичні малюнки оформлюємо в лабораторному зошиті.',
    resource: ['Біологія · Лабораторний практикум', 'https://study.example/biology'],
    tasks: [
      'Намалювати схему рослинної клітини. Підписати основні частини та коротко описати їхні функції.',
      'Заповнити таблицю порівняння рослинної та тваринної клітин. Виділити спільні й відмінні ознаки.',
      'Скласти приклад харчового ланцюга лісової екосистеми. Пояснити роль кожної його ланки.',
    ],
  },
  {
    key: 'geography', name: 'Географія', icon: 'map', teacher: 'Дмитро Шевченко', room: '214',
    palette: 'Лазур', colors: ['#056CA6', '#4245DC'],
    note: 'Природні зони, клімат і читання карт. Для практичних завдань потрібні атлас та кольорові олівці.',
    resource: ['Географія · Атлас і практичні роботи', 'https://study.example/geography'],
    tasks: [
      'Позначити на контурній карті материки й океани. Додати умовні позначення та охайний заголовок.',
      'Порівняти клімат двох обраних міст. Оформити таблицю температур і кількості опадів.',
      'Скласти маршрут одноденної подорожі. За масштабом карти визначити відстані між зупинками.',
    ],
  },
  {
    key: 'art', name: 'Мистецтво', icon: 'art', teacher: 'Катерина Савчук', room: '310',
    palette: 'Фуксія', colors: ['#7A1DD0', '#CF1762'],
    note: 'Колір, композиція та візуальні образи. Для творчої практики беремо скетчбук, олівці й фарби.',
    resource: ['Мистецтво · Творча майстерня', 'https://study.example/art'],
    tasks: [
      'Створити ескіз осіннього пейзажу. Обрати три основні кольори й визначити центр композиції.',
      'Зібрати колаж “Мій настрій у кольорах”. Коротко пояснити вибір відтінків і матеріалів.',
      'Обрати картину для обговорення. Звернути увагу на світло, деталі та загальне враження.',
    ],
  },
  {
    key: 'sport', name: 'Фізична культура', icon: 'run', teacher: 'Максим Ткаченко', room: 'Спортзал', building: 'Спортивний корпус',
    palette: 'Полум’я', colors: ['#DF2C00', '#A16C00'],
    note: 'Рухливі ігри, координація та командна взаємодія. На заняття потрібні спортивний одяг і змінне взуття.',
    resource: ['Фізична культура · Матеріали до занять', 'https://study.example/sport'],
    tasks: [
      'Повторити правила волейболу. Підготувати коротку пам’ятку про подачу, передачу та командну взаємодію.',
      'Заповнити щоденник рухової активності за тиждень. Записати вид занять і власні враження.',
      'Підготувати для групи пояснення трьох рухливих ігор. Вказати мету, правила та потрібний інвентар.',
    ],
  },
];

const englishCourses = {
  math: {
    name: 'Maths', teacher: 'Emily Carter', palette: 'Indigo', room: 'M1', building: 'Maths Block',
    note: 'Algebra, graphs and geometry. Bring your exercise book, a ruler and a scientific calculator.',
    resourceName: 'Maths · Revision workbook',
    tasks: [
      'Complete questions 12–18 on simultaneous equations. Show your working and check each answer.',
      'Plot three straight-line graphs. Label the axes and identify the gradient and intercept of each line.',
      'Work out the sale prices of five items after a percentage discount. Show your calculations in pounds.',
    ],
  },
  english: {
    name: 'English Language', teacher: 'James Wilson', palette: 'Sunset', room: 'E2', building: 'English Block',
    note: 'Creative writing, reading comprehension and spoken language. Keep planning notes and first drafts in your exercise book.',
    resourceName: 'English Language · Writing practice',
    tasks: [
      'Write a 250-word description of a rainy afternoon. Use sensory detail and vary your sentence openings.',
      'Read the extract and explain how the writer creates atmosphere. Support your points with short quotations.',
      'Prepare a two-minute talk about a hobby you enjoy. Include a clear introduction and a memorable ending.',
    ],
  },
  literature: {
    name: 'English Literature', teacher: 'Olivia Bennett', palette: 'Ruby', room: 'E3', building: 'English Block',
    note: 'Novels, poetry and close reading. Bring your reading journal and note the page numbers of useful quotations.',
    resourceName: 'English Literature · Reading journal',
    tasks: [
      'Read the next chapter and choose three quotations that reveal the narrator’s character. Add a brief comment on each.',
      'Write a paragraph comparing two characters. Explain one similarity and one difference, using evidence from the text.',
      'Annotate the poem from today’s lesson. Identify its central image and explain the effect of two language choices.',
    ],
  },
  biology: {
    name: 'Biology', teacher: 'Daniel Harris', palette: 'Emerald', room: 'B1', building: 'Science Block',
    note: 'Cell biology and ecology. Record practical work, labelled diagrams and observations in your science exercise book.',
    resourceName: 'Biology · Practical workbook',
    tasks: [
      'Draw and label a plant cell. Describe the functions of the nucleus, cell membrane, cell wall and chloroplasts.',
      'Complete the plant and animal cell comparison sheet. Use clear diagrams to explain the main differences.',
      'Draw a food web for a woodland habitat. Label the producers and consumers and explain what the arrows represent.',
    ],
  },
  geography: {
    name: 'Geography', teacher: 'Sophie Reed', palette: 'Azure', room: 'G2', building: 'Humanities Block',
    note: 'Weather, landscapes and map skills. Bring your atlas, a ruler and coloured pencils for annotated diagrams.',
    resourceName: 'Geography · Map skills workbook',
    tasks: [
      'Complete the map skills worksheet. Practise six-figure grid references and measuring distances using the scale.',
      'Compare the climate graphs for London and Edinburgh. Describe two similarities and two differences.',
      'Plan a walking route through a national park. Calculate its length and describe the main landscape features.',
    ],
  },
  art: {
    name: 'Art & Design', teacher: 'Charlotte Evans', palette: 'Fuchsia', room: 'Art Studio', building: 'Creative Arts Block',
    note: 'Drawing, colour and mixed media. Bring your sketchbook and add short annotations explaining your creative choices.',
    resourceName: 'Art & Design · Sketchbook ideas',
    tasks: [
      'Make an observational drawing of an autumn leaf. Use pencil shading to show texture and changes in tone.',
      'Create a mixed-media sketchbook page inspired by the coast. Annotate your choice of colours and materials.',
      'Choose an artist whose work you admire. Add two small studies and explain how they could influence your own work.',
    ],
  },
  sport: {
    name: 'PE', teacher: 'Thomas Brooks', palette: 'Flame', room: 'Sports Hall', building: 'Sports Centre', lessonType: 'Practice',
    note: 'Team games, movement skills and fair play. Bring your PE kit, indoor trainers and a water bottle.',
    resourceName: 'PE · Skills and teamwork',
    tasks: [
      'Review the rules of badminton doubles. Draw the court markings and explain how service changes during a game.',
      'Complete your activity diary for the week. Reflect on one skill you improved and set a goal for the next lesson.',
      'Plan a small-sided team game for the class. List the equipment, basic rules and ways to include every player.',
    ],
  },
};

const englishLessonTypes = {
  'лекція': 'Lesson', 'практична': 'Workshop', 'лабораторна': 'Practical', 'семінар': 'Discussion',
};

const weekLessons = [
  [
    [['math', 'лекція'], ['english', 'практична'], ['biology', 'лабораторна'], ['art', 'практична']],
    [['geography', 'лекція'], ['literature', 'семінар'], ['english', 'практична'], ['sport', 'практична']],
    [['biology', 'лекція'], ['math', 'практична'], ['art', 'практична'], ['literature', 'семінар']],
    [['math', 'практична'], ['geography', 'практична'], ['english', 'практична'], ['sport', 'практична']],
    [['literature', 'лекція'], ['art', 'семінар'], ['biology', 'лабораторна'], ['geography', 'практична']],
  ],
  [
    [['english', 'практична'], ['math', 'лекція'], ['literature', 'семінар'], ['biology', 'лабораторна']],
    [['geography', 'практична'], ['art', 'практична'], ['english', 'практична'], ['sport', 'практична']],
    [['math', 'практична'], ['biology', 'лекція'], ['geography', 'лекція'], ['literature', 'семінар']],
    [['literature', 'лекція'], ['english', 'практична'], ['art', 'семінар'], ['sport', 'практична']],
    [['art', 'практична'], ['geography', 'практична'], ['math', 'семінар'], ['biology', 'лабораторна']],
  ],
];

export function createUniversityContentSchedule(dateInput = new Date(), language = 'uk') {
  const now = new Date(dateInput);
  const isEnglish = language === 'en';
  const localizedCourses = courses.map(course => {
    if (!isEnglish) return course;
    const adaptation = englishCourses[course.key];
    return { ...course, ...adaptation, resource: [adaptation.resourceName, course.resource[1]] };
  });
  const teachers = localizedCourses.map(course => ({ id: generateId(), name: course.teacher }));
  const links = localizedCourses.map(course => ({
    id: generateId(), name: course.resource[0], url: course.resource[1], type: 'website',
  }));
  const gradients = localizedCourses.map(course => ({
    id: generateId(), name: course.palette, type: 'linear', angle: 0,
    colors: course.colors.map((color, position) => ({ color, position })),
  }));
  const subjects = localizedCourses.map((course, index) => ({
    id: generateId(), name: course.name, icon: course.icon,
    color: course.colors[0], typeColor: 'gradient', colorGradient: gradients[index].id,
    teachers: [teachers[index].id], links: [links[index].id],
    room: course.room, building: course.building || (isEnglish ? 'Main Building' : 'Головний корпус'), note: course.note,
  }));
  const subjectByKey = new Map(localizedCourses.map((course, index) => [course.key, subjects[index]]));
  const schedule = Array.from({ length: 7 }, () => ({ week1: [], week2: [] }));
  weekLessons.forEach((days, weekIndex) => {
    days.forEach((lessons, dayIndex) => {
      schedule[dayIndex][`week${weekIndex + 1}`] = lessons.map(([key, type], index) => ({
        subjectId: subjectByKey.get(key).id,
        type: isEnglish ? (englishCourses[key].lessonType || englishLessonTypes[type]) : type,
        timeMode: 'slot', slotNumber: index + 1,
        recurrence: { id: generateId(), mode: 'selected', weeks: [weekIndex + 1] },
      }));
    });
  });

  const result = {
    id: generateId(), name: isEnglish ? 'School · Year 10' : 'Навчання · Група А', color: '#7C3AED',
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
  const courseBySubjectId = new Map(subjects.map((subject, index) => [subject.id, localizedCourses[index]]));
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
