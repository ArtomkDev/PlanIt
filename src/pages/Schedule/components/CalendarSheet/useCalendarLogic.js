import { useState, useMemo, useCallback } from 'react';
import { useSchedule } from '../../../../context/ScheduleProvider';
import { t } from '../../../../utils/i18n';

export function useCalendarLogic(initialDate, schedule) {
  const { global , lang} = useSchedule();

  const [viewDate, setViewDate] = useState(new Date(initialDate));

  const startingWeekDateStr = schedule?.starting_week || new Date().toISOString().split('T')[0];
  const totalWeeks = schedule?.repeat || 1;

  const startSemesterDate = useMemo(() => new Date(startingWeekDateStr), [startingWeekDateStr]);
  const firstDayOfWeek = startSemesterDate.getDay(); 

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const days = [];

    let startDayIndex = firstDayOfMonth.getDay() - firstDayOfWeek;
    if (startDayIndex < 0) startDayIndex += 7;

    for (let i = startDayIndex; i > 0; i--) {
      days.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    const TOTAL_CELLS = 42; 
    let nextMonthDay = 1;
    while (days.length < TOTAL_CELLS) {
      days.push({ date: new Date(year, month + 1, nextMonthDay++), isCurrentMonth: false });
    }

    return days;
  }, [viewDate, firstDayOfWeek]);

  const getWeekNumber = useCallback((date) => {
    if (totalWeeks <= 1) return null;
    
    const startWeekD = new Date(startSemesterDate); 
    startWeekD.setHours(12, 0, 0, 0);
    
    const targetD = new Date(date); 
    targetD.setHours(12, 0, 0, 0);
    
    let dayDiff = targetD.getDay() - firstDayOfWeek;
    if (dayDiff < 0) dayDiff += 7;
    targetD.setDate(targetD.getDate() - dayDiff);

    const diffTime = targetD.getTime() - startWeekD.getTime();
    const absoluteWeekNum = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));

    let cycleNum = (absoluteWeekNum % totalWeeks);
    if (cycleNum < 0) cycleNum += totalWeeks;
    
    return cycleNum + 1;
  }, [startSemesterDate, firstDayOfWeek, totalWeeks]);

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  
  const setMonth = (monthIndex) => setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
  const setYear = (year) => setViewDate(new Date(year, viewDate.getMonth(), 1));

  const weekDayNames = useMemo(() => {
    const locale = t('locale', lang);
    
    const names = [];
    const baseDate = new Date(2023, 0, 1); 
    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);
      const dayStr = date.toLocaleDateString(locale, { weekday: 'short' });
      names.push(dayStr.charAt(0).toUpperCase() + dayStr.slice(1));
    }

    return [...names.slice(firstDayOfWeek), ...names.slice(0, firstDayOfWeek)];
  }, [firstDayOfWeek, lang]);

  return {
    viewDate,
    calendarDays,
    weekDayNames,
    getWeekNumber,
    nextMonth,
    prevMonth,
    setMonth,
    setYear,
    firstDayOfWeek
  };
}