import { useState, useMemo, useCallback } from 'react';

export function useCalendarLogic(initialDate, schedule) {
  const [viewDate, setViewDate] = useState(new Date(initialDate));

  // Налаштування з розкладу
  const startingWeekDateStr = schedule?.starting_week || new Date().toISOString().split('T')[0];
  const totalWeeks = schedule?.repeat || 1;

  // Визначаємо перший день тижня
  const startSemesterDate = useMemo(() => new Date(startingWeekDateStr), [startingWeekDateStr]);
  const firstDayOfWeek = startSemesterDate.getDay(); 

  // Генерація днів
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
    
    // 🔥 ВАЖЛИВО: Завжди додаємо дні до 6 тижнів (42 клітинки), 
    // щоб висота календаря була стабільною
    const TOTAL_CELLS = 42; 
    let nextMonthDay = 1;
    while (days.length < TOTAL_CELLS) {
      days.push({ date: new Date(year, month + 1, nextMonthDay++), isCurrentMonth: false });
    }

    return days;
  }, [viewDate, firstDayOfWeek]);

  // Розрахунок тижня
  const getWeekNumber = useCallback((date) => {
    if (totalWeeks <= 1) return null;
    const d1 = new Date(startSemesterDate); d1.setHours(0,0,0,0);
    const d2 = new Date(date); d2.setHours(0,0,0,0);
    
    let dayDiff = d2.getDay() - firstDayOfWeek;
    if (dayDiff < 0) dayDiff += 7;
    d2.setDate(d2.getDate() - dayDiff);

    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const absoluteWeekNum = Math.floor(diffDays / 7);

    let cycleNum = (absoluteWeekNum % totalWeeks);
    if (cycleNum < 0) cycleNum += totalWeeks;
    return cycleNum + 1;
  }, [startSemesterDate, firstDayOfWeek, totalWeeks]);

  // Навігація
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  
  // 🔥 НОВІ МЕТОДИ
  const setMonth = (monthIndex) => setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
  const setYear = (year) => setViewDate(new Date(year, viewDate.getMonth(), 1));

  const weekDayNames = useMemo(() => {
    const names = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return [...names.slice(firstDayOfWeek), ...names.slice(0, firstDayOfWeek)];
  }, [firstDayOfWeek]);

  return {
    viewDate,
    calendarDays,
    weekDayNames,
    getWeekNumber,
    nextMonth,
    prevMonth,
    setMonth, // New
    setYear,  // New
    firstDayOfWeek
  };
}