import { generateId } from "./idGenerator";

const LIMITS = {
  name: 80,
  shortName: 32,
  note: 500,
  url: 2048,
  room: 80,
  building: 80,
  phone: 40,
  email: 120,
  color: 32,
  icon: 48,
  subjects: 250,
  teachers: 250,
  links: 250,
  gradients: 100,
  days: 7,
  weeks: 12,
  lessonsPerWeek: 40,
  breaks: 40,
  gradientStops: 8,
};

const WEEK_KEY_RE = /^week([1-9]|1[0-2])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_RE = /^#?[0-9a-fA-F]{3,8}$/;

const isPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const cleanString = (value, maxLength, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  const raw = String(value);
  const bounded = raw.length > maxLength * 4 ? raw.slice(0, maxLength * 4) : raw;
  const clean = bounded.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return clean.slice(0, maxLength);
};

const cleanId = (value) => {
  const clean = cleanString(value, 96);
  return clean || undefined;
};

const cleanOptionalString = (value, maxLength) => {
  const clean = cleanString(value, maxLength);
  return clean || undefined;
};

const cleanTime = (value) => {
  const clean = cleanString(value, 5);
  return TIME_RE.test(clean) ? clean : undefined;
};

const cleanColor = (value) => {
  const clean = cleanString(value, LIMITS.color);
  if (!clean) return undefined;
  if (HEX_RE.test(clean)) return clean.startsWith("#") ? clean : `#${clean}`;
  if (/^[a-zA-Z0-9_-]{1,32}$/.test(clean)) return clean;
  return undefined;
};

const cleanIdArray = (value, maxItems = 20) => {
  if (value === undefined || value === null) return undefined;
  const stack = Array.isArray(value) ? value.slice(0, maxItems * 4).reverse() : [value];
  const result = [];
  const seen = new Set();
  let inspected = 0;

  while (stack.length > 0 && result.length < maxItems && inspected < maxItems * 20) {
    const item = stack.pop();
    inspected += 1;

    if (Array.isArray(item)) {
      const limit = Math.min(item.length, maxItems * 4);
      for (let index = limit - 1; index >= 0; index -= 1) {
        stack.push(item[index]);
      }
      continue;
    }

    const id = cleanId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result.length > 0 ? result : undefined;
};

const cleanUrl = (value) => {
  const clean = cleanOptionalString(value, LIMITS.url);
  if (!clean) return undefined;

  const protocolMatch = clean.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!protocolMatch) return undefined;

  const protocol = protocolMatch[1].toLowerCase();

  if (protocol === "http" || protocol === "https") {
    if (!/^https?:\/\//i.test(clean)) return undefined;

    if (typeof URL === "function") {
      try {
        const parsed = new URL(clean);
        return parsed.protocol === "http:" || parsed.protocol === "https:"
          ? clean
          : undefined;
      } catch (error) {
        return undefined;
      }
    }

    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(clean) ? clean : undefined;
  }

  if (protocol === "mailto") {
    return /^mailto:[^\s]+$/i.test(clean) ? clean : undefined;
  }

  if (protocol === "tel") {
    return /^tel:[0-9a-z+().,;=%*#-]+$/i.test(clean) ? clean : undefined;
  }

  return undefined;
};

const cleanIsoDate = (value) => {
  const clean = cleanString(value, 40);
  if (!clean) return new Date().toISOString();
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const pushIfDefined = (target, key, value) => {
  if (value !== undefined) target[key] = value;
};

const sanitizeTeacher = (teacher) => {
  if (!isPlainObject(teacher)) return null;
  const id = cleanId(teacher.id);
  if (!id) return null;

  const result = {
    id,
    name: cleanString(teacher.name, LIMITS.name, "Teacher"),
  };

  pushIfDefined(result, "shortName", cleanOptionalString(teacher.shortName, LIMITS.shortName));
  pushIfDefined(result, "email", cleanOptionalString(teacher.email, LIMITS.email));
  pushIfDefined(result, "phone", cleanOptionalString(teacher.phone, LIMITS.phone));

  return result;
};

const sanitizeLink = (link) => {
  if (!isPlainObject(link)) return null;
  const id = cleanId(link.id);
  if (!id) return null;

  const result = {
    id,
    name: cleanString(link.name, LIMITS.name, "Link"),
  };

  pushIfDefined(result, "url", cleanUrl(link.url));

  return result;
};

const sanitizeGradientStop = (stop) => {
  if (typeof stop === "string") {
    const color = cleanColor(stop);
    return color || null;
  }

  if (!isPlainObject(stop)) return null;
  const color = cleanColor(stop.color);
  if (!color) return null;

  return {
    color,
    position: clampNumber(stop.position, 0, 1, 0),
  };
};

const sanitizeGradient = (gradient) => {
  if (!isPlainObject(gradient)) return null;
  const id = cleanId(gradient.id);
  if (!id) return null;

  const colors = Array.isArray(gradient.colors)
    ? gradient.colors.slice(0, LIMITS.gradientStops).map(sanitizeGradientStop).filter(Boolean)
    : [];

  if (colors.length === 0) return null;

  const result = {
    id,
    type: cleanString(gradient.type, 16, "linear") === "radial" ? "radial" : "linear",
    angle: clampNumber(gradient.angle, 0, 360, 90),
    colors,
  };

  pushIfDefined(result, "name", cleanOptionalString(gradient.name, LIMITS.name));

  return result;
};

const sanitizeSubject = (subject, options) => {
  if (!isPlainObject(subject)) return null;
  const id = cleanId(subject.id);
  if (!id) return null;

  const result = {
    id,
    name: cleanString(subject.name, LIMITS.name, "Subject"),
  };

  pushIfDefined(result, "shortName", cleanOptionalString(subject.shortName, LIMITS.shortName));
  pushIfDefined(result, "type", cleanOptionalString(subject.type, LIMITS.name));
  pushIfDefined(result, "room", cleanOptionalString(subject.room, LIMITS.room));
  pushIfDefined(result, "building", cleanOptionalString(subject.building, LIMITS.building));
  pushIfDefined(result, "icon", cleanOptionalString(subject.icon, LIMITS.icon));

  if (options.shareTeachers !== false) {
    pushIfDefined(result, "teacher", cleanId(subject.teacher));
    pushIfDefined(result, "teachers", cleanIdArray(subject.teachers || subject.teacher, 20));
  }

  if (options.shareLinks !== false) {
    pushIfDefined(result, "link", cleanId(subject.link));
    pushIfDefined(result, "links", cleanIdArray(subject.links || subject.link, 20));
  }

  if (options.shareNotes !== false) {
    pushIfDefined(result, "note", cleanOptionalString(subject.note, LIMITS.note));
  }

  if (options.shareGradients !== false) {
    pushIfDefined(result, "color", cleanColor(subject.color));
    pushIfDefined(result, "typeColor", cleanOptionalString(subject.typeColor, 16));
    pushIfDefined(result, "colorGradient", cleanId(subject.colorGradient));
  }

  return result;
};

const sanitizeLesson = (lesson, options) => {
  if (typeof lesson === "string" || typeof lesson === "number") {
    const subjectId = cleanId(lesson);
    return subjectId ? { subjectId } : null;
  }

  if (!isPlainObject(lesson)) return null;

  const subjectId = cleanId(lesson.subjectId || lesson.subject || lesson.id);
  if (!subjectId) return null;

  const result = { subjectId };

  pushIfDefined(result, "type", cleanOptionalString(lesson.type, LIMITS.name));
  pushIfDefined(result, "room", cleanOptionalString(lesson.room, LIMITS.room));
  pushIfDefined(result, "building", cleanOptionalString(lesson.building, LIMITS.building));
  pushIfDefined(result, "startTime", cleanTime(lesson.startTime));
  pushIfDefined(result, "endTime", cleanTime(lesson.endTime));
  pushIfDefined(result, "defaultStartTime", cleanTime(lesson.defaultStartTime));
  pushIfDefined(result, "defaultEndTime", cleanTime(lesson.defaultEndTime));

  if (options.shareTeachers !== false) {
    pushIfDefined(result, "teacher", cleanId(lesson.teacher));
    pushIfDefined(result, "teachers", cleanIdArray(lesson.teachers || lesson.teacher, 20));
  }

  if (options.shareLinks !== false) {
    pushIfDefined(result, "link", cleanId(lesson.link));
    pushIfDefined(result, "links", cleanIdArray(lesson.links || lesson.link, 20));
  }

  if (options.shareNotes !== false) {
    pushIfDefined(result, "note", cleanOptionalString(lesson.note, LIMITS.note));
  }

  if (options.shareGradients !== false) {
    pushIfDefined(result, "color", cleanColor(lesson.color));
    pushIfDefined(result, "gradient", cleanId(lesson.gradient));
  }

  return result;
};

const sanitizeScheduleGrid = (scheduleGrid, options) => {
  if (!Array.isArray(scheduleGrid)) return [];

  return scheduleGrid.slice(0, LIMITS.days).map((day) => {
    if (!isPlainObject(day)) return {};

    return Object.keys(day).reduce((acc, weekKey) => {
      if (!WEEK_KEY_RE.test(weekKey) || !Array.isArray(day[weekKey])) return acc;

      const lessons = day[weekKey]
        .slice(0, LIMITS.lessonsPerWeek)
        .map((lesson) => sanitizeLesson(lesson, options))
        .filter(Boolean);

      acc[weekKey] = lessons;
      return acc;
    }, {});
  });
};

const countLessons = (scheduleGrid) => {
  return scheduleGrid.reduce((total, day) => {
    if (!isPlainObject(day)) return total;

    return total + Object.values(day).reduce((dayTotal, lessons) => {
      return dayTotal + (Array.isArray(lessons) ? lessons.length : 0);
    }, 0);
  }, 0);
};

const sanitizeBreaks = (breaks) => {
  if (!Array.isArray(breaks)) return [];
  return breaks
    .slice(0, LIMITS.breaks)
    .map((value) => Math.round(clampNumber(value, 0, 600, 10)));
};

const compactRefs = (schedule) => {
  const subjectIds = new Set(schedule.subjects.map((item) => item.id));
  const teacherIds = new Set(schedule.teachers.map((item) => item.id));
  const linkIds = new Set(schedule.links.map((item) => item.id));
  const gradientIds = new Set(schedule.gradients.map((item) => item.id));

  schedule.subjects = schedule.subjects
    .filter((subject) => subjectIds.has(subject.id))
    .map((subject) => {
      const next = { ...subject };
      if (next.teacher && !teacherIds.has(next.teacher)) delete next.teacher;
      if (next.teachers) {
        next.teachers = next.teachers.filter((id) => teacherIds.has(id));
        if (next.teachers.length === 0) delete next.teachers;
      }
      if (next.link && !linkIds.has(next.link)) delete next.link;
      if (next.links) {
        next.links = next.links.filter((id) => linkIds.has(id));
        if (next.links.length === 0) delete next.links;
      }
      if (next.colorGradient && !gradientIds.has(next.colorGradient)) {
        delete next.colorGradient;
        if (next.typeColor === "gradient") delete next.typeColor;
      }
      return next;
    });

  schedule.schedule = schedule.schedule.map((day) => {
    const nextDay = {};
    Object.entries(day).forEach(([weekKey, lessons]) => {
      nextDay[weekKey] = lessons
        .filter((lesson) => subjectIds.has(lesson.subjectId))
        .map((lesson) => {
          const next = { ...lesson };
          if (next.teacher && !teacherIds.has(next.teacher)) delete next.teacher;
          if (next.teachers) {
            next.teachers = next.teachers.filter((id) => teacherIds.has(id));
            if (next.teachers.length === 0) delete next.teachers;
          }
          if (next.link && !linkIds.has(next.link)) delete next.link;
          if (next.links) {
            next.links = next.links.filter((id) => linkIds.has(id));
            if (next.links.length === 0) delete next.links;
          }
          if (next.gradient && !gradientIds.has(next.gradient)) delete next.gradient;
          return next;
        });
    });
    return nextDay;
  });

  return schedule;
};

const sanitizeScheduleCore = (input, options = {}, metadata) => {
  if (!isPlainObject(input)) {
    throw new Error("invalid_shared_schedule");
  }

  const scheduleGrid = sanitizeScheduleGrid(input.schedule, options);

  if (metadata) {
    metadata.lessonRefsBeforeCompact = countLessons(scheduleGrid);
  }

  const schedule = {
    name: cleanString(input.name, LIMITS.name, "Imported schedule"),
    repeat: Math.round(clampNumber(input.repeat, 1, LIMITS.weeks, 1)),
    duration: Math.round(clampNumber(input.duration, 1, 600, 45)),
    breaks: sanitizeBreaks(input.breaks),
    start_time: cleanTime(input.start_time) || "08:30",
    starting_week: cleanIsoDate(input.starting_week),
    subjects: Array.isArray(input.subjects)
      ? input.subjects.slice(0, LIMITS.subjects).map((item) => sanitizeSubject(item, options)).filter(Boolean)
      : [],
    teachers: options.shareTeachers === false || !Array.isArray(input.teachers)
      ? []
      : input.teachers.slice(0, LIMITS.teachers).map(sanitizeTeacher).filter(Boolean),
    links: options.shareLinks === false || !Array.isArray(input.links)
      ? []
      : input.links.slice(0, LIMITS.links).map(sanitizeLink).filter(Boolean),
    gradients: options.shareGradients === false || !Array.isArray(input.gradients)
      ? []
      : input.gradients.slice(0, LIMITS.gradients).map(sanitizeGradient).filter(Boolean),
    schedule: scheduleGrid,
  };

  pushIfDefined(schedule, "color", options.shareGradients === false ? undefined : cleanColor(input.color));

  return compactRefs(schedule);
};

export const sanitizeSharedSchedule = (input, options = {}) => {
  return sanitizeScheduleCore(input, options);
};

const assertImportShape = (input) => {
  if (!isPlainObject(input)) {
    throw new Error("invalid_shared_schedule");
  }

  if (!Array.isArray(input.schedule) || input.schedule.length > LIMITS.days) {
    throw new Error("invalid_shared_schedule");
  }

  const repeat = Number(input.repeat);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > LIMITS.weeks) {
    throw new Error("invalid_shared_schedule");
  }

  if (!Array.isArray(input.subjects)) {
    throw new Error("invalid_shared_schedule");
  }
};

export const sanitizeImportedSchedule = (input, now = Date.now()) => {
  assertImportShape(input);

  const metadata = { lessonRefsBeforeCompact: 0 };
  const sanitized = sanitizeScheduleCore(input, {
    shareTeachers: true,
    shareLinks: true,
    shareNotes: true,
    shareGradients: true,
  }, metadata);

  const lessonCount = countLessons(sanitized.schedule);
  if (
    (sanitized.subjects.length === 0 && lessonCount === 0)
    || (metadata.lessonRefsBeforeCompact > 0 && lessonCount === 0)
  ) {
    throw new Error("invalid_shared_schedule");
  }

  return {
    ...sanitized,
    id: generateId(),
    isCloud: false,
    isDeleted: false,
    version: 1,
    baseVersion: 1,
    lastModified: now,
    lastSynced: 0,
  };
};
