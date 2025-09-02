import { v4 as uuidv4 } from 'uuid';
import defaultSchedule from './defaultSchedule';

export default function createDefaultData() {
  const scheduleId = uuidv4();

  return {
    global: {
      currentScheduleId: scheduleId,
      theme: ['dark', 'red'],
      auto_save: 8,
    },
    schedules: [
      {
        ...defaultSchedule,
        id: scheduleId,
        name: 'Основний розклад',
      },
    ],
  };
}
