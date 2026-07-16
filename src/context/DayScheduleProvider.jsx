import React, { createContext, useContext, useMemo } from "react";
import { useScheduleActions, useScheduleData } from "./ScheduleProvider";
import {
  calculateScheduleWeek,
  getScheduleDayIndex,
  getScheduleDayLessons,
} from "../utils/scheduleTime";

const DayScheduleContext = createContext(null);

export const DayScheduleProvider = ({ children, date }) => {
  const { schedule } = useScheduleData();
  const { reloadAllSchedules } = useScheduleActions();

  const getDayIndex = (targetDate) => getScheduleDayIndex(targetDate);
  const calculateCurrentWeek = (targetDate) => calculateScheduleWeek(schedule, targetDate);
  const getDaySchedule = (targetDate) => getScheduleDayLessons(schedule, targetDate);

  const isToday = date.toDateString() === new Date().toDateString();

  const value = useMemo(
    () => ({
      currentDate: date,
      getDaySchedule,
      getDayIndex,
      calculateCurrentWeek,
      subjects: schedule?.subjects || [],
      teachers: schedule?.teachers || [],
      lessonTimes: schedule?.lessonTimes || [],
      isToday,
      reloadDaySchedule: reloadAllSchedules, 
    }),
    [date.getTime(), schedule, isToday, reloadAllSchedules]
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
