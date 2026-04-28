export const formatTime = (mins) => 
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export function parseRealSchedule(scheduleData, targetDate, dateOffset) {
  if (!scheduleData || !scheduleData.schedule) {
    return { items: [], currentWeekNum: 1, totalWeeks: 1 };
  }

  try {
    let dayIndex = targetDate.getDay() - 1;
    if (dayIndex < 0) dayIndex = 6;

    let currentWeekNum = 1;
    let totalWeeks = scheduleData.repeat || 1;

    if (scheduleData.starting_week && totalWeeks > 1) {
      const start = new Date(scheduleData.starting_week);
      start.setHours(0, 0, 0, 0);
      const target = new Date(targetDate);
      target.setHours(0, 0, 0, 0);
      const weeksPassed = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
      let mod = weeksPassed % totalWeeks;
      if (mod < 0) mod += totalWeeks;
      currentWeekNum = mod + 1;
    }
    
    const weekKey = `week${currentWeekNum}`;
    const dayObj = scheduleData.schedule[dayIndex] || {};
    const rawLessons = Array.isArray(dayObj[weekKey]) ? dayObj[weekKey] : [];

    const subjects = scheduleData.subjects || [];
    const teachersList = scheduleData.teachers || [];
    const gradients = scheduleData.gradients || [];
    const breaks = scheduleData.breaks || [];
    const duration = scheduleData.duration || 45;

    let baseMins = 8 * 60 + 30; 
    if (scheduleData.start_time) {
      const [h, m] = scheduleData.start_time.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) baseMins = h * 60 + m;
    }

    const isToday = dateOffset === 0;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    
    let timeline = [];
    let currentMins = baseMins;

    for (let i = 0; i < rawLessons.length; i++) {
      const item = rawLessons[i];
      let bDuration = breaks.length > 0 ? (Number(breaks[i % breaks.length]) || 0) : 10;
      
      let actualStart = currentMins;
      let actualEnd = currentMins + duration;

      if (item) {
        const isInstance = typeof item === 'object' && item !== null;
        const lessonData = isInstance ? item : {};
        const subjectId = isInstance ? (item.subjectId || item.subject || item.id) : item;

        if (lessonData.startTime) {
          const [h, m] = lessonData.startTime.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) actualStart = h * 60 + m;
        }

        if (lessonData.endTime) {
          const [h, m] = lessonData.endTime.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) actualEnd = h * 60 + m;
        } else if (lessonData.startTime) {
          actualEnd = actualStart + duration; 
        }

        timeline.push({
          item,
          isLesson: true,
          actualStart,
          actualEnd,
          subjectId,
          lessonData
        });
      } else {
        timeline.push({
          item: null,
          isLesson: false,
          actualStart,
          actualEnd
        });
      }

      currentMins = actualEnd + bDuration;
    }

    let targetBreakIndex = -1;
    if (isToday) {
      for (let i = 0; i < timeline.length; i++) {
        if (!timeline[i].isLesson) continue;
        
        let nextLesson = null;
        for (let j = i + 1; j < timeline.length; j++) {
          if (timeline[j].isLesson) {
            nextLesson = timeline[j];
            break;
          }
        }
        
        if (nextLesson) {
          let realBreakStart = timeline[i].actualEnd;
          let realBreakEnd = nextLesson.actualStart;
          if (nowMins >= realBreakStart && nowMins < realBreakEnd) {
            targetBreakIndex = i;
            break;
          } else if (nowMins < realBreakStart && targetBreakIndex === -1) {
            targetBreakIndex = i;
          }
        }
      }
    }

    const items = [];

    for (let i = 0; i < timeline.length; i++) {
      const tInfo = timeline[i];
      if (!tInfo.isLesson) continue; 
      
      const { lessonData, subjectId } = tInfo;
      const subjectObj = subjects.find(s => s.id === subjectId) || {};
      
      let color = '#0A84FF'; 
      if (lessonData.color) {
        color = lessonData.color; 
      } else if (subjectObj.typeColor === "gradient" && subjectObj.colorGradient) {
        const activeGrad = gradients.find(g => g.id === subjectObj.colorGradient);
        if (activeGrad && activeGrad.colors && activeGrad.colors.length > 0) {
          color = activeGrad.colors[0].color || activeGrad.colors[0]; 
        }
      } else if (subjectObj.color) {
        color = subjectObj.color; 
      }
      if (Array.isArray(color)) color = color[0]; 

      let teacherName = lessonData.teacherName || lessonData.teacher;
      if (!teacherName && lessonData.teacherId) {
        teacherName = teachersList.find(t => t.id === lessonData.teacherId)?.name;
      }
      if (!teacherName && subjectObj.teachers && subjectObj.teachers.length > 0) {
        teacherName = subjectObj.teachers.map(tId => teachersList.find(t => t.id === tId)?.name).filter(Boolean).join(', ');
      }
      
      let room = lessonData.room || lessonData.cabinet || subjectObj.room || subjectObj.cabinet || '';
      let extraInfo = lessonData.info || lessonData.notes || '';

      let detailsArray = [];
      if (room) detailsArray.push(room);
      if (teacherName) detailsArray.push(teacherName);
      if (extraInfo) detailsArray.push(extraInfo);

      const isCurrentLesson = isToday && nowMins >= tInfo.actualStart && nowMins < tInfo.actualEnd;
      const minutesLeft = tInfo.actualEnd - nowMins;

      items.push({
        type: 'lesson',
        id: lessonData.id || subjectId,
        dayIndex: dayIndex,
        lessonIndex: i,
        subject: lessonData.name || subjectObj.name || 'Пара',
        details: detailsArray.join(' • ') || 'Немає деталей',
        color: color,
        startTime: formatTime(tInfo.actualStart),
        endTime: formatTime(tInfo.actualEnd),
        isCurrent: isCurrentLesson,
        minutesLeft: minutesLeft > 0 ? minutesLeft : 0
      });

      if (i === targetBreakIndex) {
        let nextLesson = null;
        for (let j = i + 1; j < timeline.length; j++) {
          if (timeline[j].isLesson) {
            nextLesson = timeline[j];
            break;
          }
        }
        
        if (nextLesson) {
          let realBreakStart = tInfo.actualEnd;
          let realBreakEnd = nextLesson.actualStart;
          let realBreakDuration = realBreakEnd - realBreakStart;
          
          if (realBreakDuration > 0) {
            const isCurrentBreak = isToday && nowMins >= realBreakStart && nowMins < realBreakEnd;
            items.push({
              type: 'break',
              startTime: formatTime(realBreakStart),
              endTime: formatTime(realBreakEnd),
              duration: realBreakDuration,
              color: color,
              isCurrent: isCurrentBreak
            });
          }
        }
      }
    }

    return { items, currentWeekNum, totalWeeks };
  } catch (e) {
    return { items: [], currentWeekNum: 1, totalWeeks: 1 };
  }
}