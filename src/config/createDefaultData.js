import { v4 as uuidv4 } from 'uuid';
import defaultSchedule from './defaultSchedule';

export default function createDefaultData() {
  const scheduleId = uuidv4();
  const now = Date.now();

  const global = {
    currentScheduleId: scheduleId,
    theme: ['dark', 'red'],
    auto_save: 8,
    lastModified: now, 
    lastSynced: 0, 
  };

  const newSchedule = {
    ...defaultSchedule,
    id: scheduleId,
    name: 'Основний розклад',
    version: 1,           
    baseVersion: 1,       
    lastModified: now,    
    lastSynced: 0, 
  };

  return { 
      global, 
      schedules: [newSchedule] 
  };
}