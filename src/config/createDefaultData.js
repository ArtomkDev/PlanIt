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
    lastSynced: now, // ДОДАНО
  };

  const newSchedule = {
    ...defaultSchedule,
    id: scheduleId,
    name: 'Основний розклад',
    // НОВІ ПОЛЯ ДЛЯ СИНХРОНІЗАЦІЇ (ВИПРАВЛЕНО):
    version: 1,           // Було cloudVersion, стало version
    baseVersion: 1,       // Версія, на базі якої робляться локальні зміни
    lastModified: now,    // Час останньої локальної зміни
    lastSynced: now,      // ДОДАНО: Час останньої успішної відправки
  };

  return { 
      global, 
      schedules: [newSchedule] 
  };
}