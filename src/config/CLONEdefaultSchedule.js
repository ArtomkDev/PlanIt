const defaultData = {
  global: {
    theme: ['dark', 'red'], // Глобальна тема для всіх розкладів
    currentScheduleId: 'schedule1', // Поточний активний розклад
  },

  schedules: [
    {
      id: 'schedule1',
      name: 'Основний розклад',
      theme: ['dark', 'red'], // Локальна тема розкладу
      auto_save: 60,
      duration: 80,
      breaks: [10, 20, 10, 10],
      repeat: 1,
      start_time: '08:30',
      starting_week: '2025-08-18',

      subjects: [
        { id: 1, name: 'Mathematics', teacher: 2, zoom_link: 'https://zoom.com/lesson1', color: 'red' },
        { id: 2, name: 'Ukrainian Language', teacher: 1, zoom_link: 'https://zoom.com/lesson2', color: 'blue' },
        { id: 3, name: 'Biology', teacher: 4, zoom_link: 'https://zoom.com/lesson3', color: 'green' },
        { id: 4, name: 'Physics', teacher: 5, zoom_link: 'https://zoom.com/lesson4', color: 'yellow' },
        { id: 5, name: 'Informatics', teacher: 3, zoom_link: 'https://zoom.com/lesson5', color: 'purple' },
      ],

      teachers: [
        { id: 1, name: 'John Doe', phone: '09340001' },
        { id: 2, name: 'Jane Smith', phone: '09340002' },
        { id: 3, name: 'Mark Brown', phone: '09340003' },
        { id: 4, name: 'Emily White', phone: '09340004' },
        { id: 5, name: 'Alice Green', phone: '09340005' },
      ],

      schedule: Array.from({ length: 7 }, () => ({
        week1: [],
        week2: [],
        week3: [],
        week4: [],
      })),
    },

    {
     id: 'schedule2',
      name: 'Основний розклад',
      theme: ['dark', 'red'], // Локальна тема розкладу
      auto_save: 60,
      duration: 80,
      breaks: [10, 20, 10, 10],
      repeat: 1,
      start_time: '08:30',
      starting_week: '2025-08-18',

      subjects: [
        { id: 1, name: 'Mathematics', teacher: 2, zoom_link: 'https://zoom.com/lesson1', color: 'red' },
        { id: 2, name: 'Ukrainian Language', teacher: 1, zoom_link: 'https://zoom.com/lesson2', color: 'blue' },
        { id: 3, name: 'Biology', teacher: 4, zoom_link: 'https://zoom.com/lesson3', color: 'green' },
      ],

      teachers: [
        { id: 1, name: 'John Doe', phone: '09340001' },
        { id: 2, name: 'Jane Smith', phone: '09340002' },
        { id: 3, name: 'Mark Brown', phone: '09340003' },
        { id: 4, name: 'Emily White', phone: '09340004' },
        { id: 5, name: 'Alice Green', phone: '09340005' },
      ],

      schedule: Array.from({ length: 7 }, () => ({
        week1: [],
        week2: [],
        week3: [],
        week4: [],
      })),
    },
  ],
};

export default defaultData;
