// DayScheduleProvider.jsx
import React, { createContext, useContext, useMemo } from "react";
import { useSchedule } from "./ScheduleProvider";

const DayScheduleContext = createContext(null);

export const DayScheduleProvider = ({ children, date }) => {
  const { schedule } = useSchedule();

  // ✅ нормалізація дати (час = 00:00:00)
  const normalizeDate = (d) => {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd;
  };

  // ✅ індекс дня (0 = Понеділок, 6 = Неділя)
  const getDayIndex = (date) => (date.getDay() === 0 ? 6 : date.getDay() - 1);

  // ✅ визначення тижня (з урахуванням repeat)
  const calculateCurrentWeek = (date) => {
    if (!schedule?.starting_week) return 1;

    const mondayFirstWeek = normalizeDate(schedule.starting_week);
    const currentDate = normalizeDate(date);

    const diffDays = Math.floor(
      (currentDate - mondayFirstWeek) / (1000 * 60 * 60 * 24)
    );

    const repeatWeeks = schedule?.repeat || 1;

    return (
      (((Math.floor(diffDays / 7) % repeatWeeks) + repeatWeeks) % repeatWeeks) + 1
    );
  };

  // ✅ отримати розклад для конкретного дня
  const getDaySchedule = (date) => {
    if (!schedule?.schedule) return [];
    const dayIndex = getDayIndex(date);
    const currentWeek = calculateCurrentWeek(date);
    return schedule.schedule[dayIndex]?.[`week${currentWeek}`] || [];
  };

  const value = useMemo(
    () => ({
      currentDate: date, // ⚡ беремо дату із props
      getDaySchedule,
      getDayIndex,
      calculateCurrentWeek,
      subjects: schedule?.subjects || [],
      teachers: schedule?.teachers || [],
      lessonTimes: schedule?.lessonTimes || [],
      isToday: date.toDateString() === new Date().toDateString(),
    }),
    [date, schedule]
  );

  return (
    <DayScheduleContext.Provider value={value}>
      {children}
    </DayScheduleContext.Provider>
  );
};

export const useDaySchedule = () => {
  const ctx = useContext(DayScheduleContext);
  if (!ctx) {
    throw new Error("useDaySchedule must be used within DayScheduleProvider");
  }
  return ctx;
};
