import { getLocalISODate } from '../utils/taskLessonLinking';

let requestSequence = 0;

export function createWidgetLessonUrl(data, scheduleId) {
  return `planit://widget/lesson?lessonViewIntent=${encodeURIComponent(JSON.stringify({
    ...data,
    scheduleId: data?.scheduleId || scheduleId,
  }))}`;
}

export function parseWidgetLessonIntent(value) {
  let data;
  try {
    data = JSON.parse(value);
  } catch (_) {
    return undefined;
  }

  if (!data || typeof data.scheduleId !== 'string' || !data.scheduleId
    || typeof data.targetDateStr !== 'string'
    || !Number.isInteger(data.lessonIndex) || data.lessonIndex < 0) return undefined;

  const date = new Date(data.targetDateStr);
  if (Number.isNaN(date.getTime())) return undefined;

  return {
    requestId: `widget-${Date.now()}-${++requestSequence}`,
    scheduleId: data.scheduleId,
    lessonRef: {
      scheduleId: data.scheduleId,
      date: getLocalISODate(date),
      lessonIndex: data.lessonIndex,
    },
  };
}
