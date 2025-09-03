import { v4 as uuidv4 } from 'uuid';
import defaultSchedule from './defaultSchedule';

export default function createDefaultData() {
  const scheduleId = uuidv4();

  const globalData = {
    currentScheduleId: scheduleId,
    theme: ['dark', 'red'],
    auto_save: 8,
  };

  const scheduleData = {
    ...defaultSchedule,
    id: scheduleId,
    name: 'Основний розклад',
  };

  return { globalData, scheduleData };
}
