export const assignScheduleId = (schedule, id) => ({
  ...schedule,
  id,
  ...(Array.isArray(schedule.tasks) ? {
    tasks: schedule.tasks.map((task) => (
      task.lessonRef?.scheduleId === schedule.id
        ? { ...task, lessonRef: { ...task.lessonRef, scheduleId: id } }
        : task
    )),
  } : {}),
});
