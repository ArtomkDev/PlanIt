import defaultSchedule from './defaultSchedule';
import { DEFAULT_SCHEDULE_NAME_KEY } from '../utils/scheduleDisplay';
import { generateId } from '../utils/idGenerator';

export default function createDefaultData() {
  const scheduleId = generateId();
  const now = Date.now();

  const global = {
    currentScheduleId: scheduleId,
    theme: ['dark', 'cyan'],
    navigationStyle: 'classic',
    navigationLabels: true,
    navigationAnimations: true,
    hapticsEnabled: true,
    fileLibrary: [],
    lastModified: now, 
    lastSynced: 0, 
  };

  const newSchedule = {
    ...defaultSchedule,
    id: scheduleId,
    name: 'Основний розклад',
    nameKey: DEFAULT_SCHEDULE_NAME_KEY,
    version: 1,           
    baseVersion: 1,       
    lastModified: now,    
    lastSynced: 0, 
  };

  return { 
      global, 
      schedules: [newSchedule],
      deletedSchedules: []
  };
}
