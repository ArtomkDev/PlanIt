import { buildDayTimeline, getScheduleWeekNumbers, calculateScheduleWeek, getLastMondayDate } from "./scheduleTime";
import { getLinkOpenUrl } from "./contactData";
import { getLocale, normalizeLanguage, t } from "./i18n";
import { getDocumentBranding } from "../config/documentBranding";

const text = (value) => typeof value === "string" ? value.trim() : "";
const asList = (value) => Array.isArray(value) ? value : value ? [value] : [];
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const capitalize = (value) => value.charAt(0).toLocaleUpperCase() + value.slice(1);

export const SCHEDULE_EXPORT_DEFAULTS = {
  layout: "grid", paper: "a4", orientation: "auto", density: "comfortable", color: "accent",
  linkStyle: "label", csvSeparator: "comma", shareLocations: true, shareTypes: true,
  showEmptyDays: false, showNumbers: true, showCycleStart: true,
  includeWeekCalendar: false,
};

const calendarDateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
const parseCalendarDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && calendarDateKey(date) === value ? date : null;
};

export const getScheduleExportCalendarRange = (schedule, weeks = 16, from) => {
  const anchor = schedule?.starting_week ? new Date(schedule.starting_week) : null;
  const start = (from instanceof Date && !Number.isNaN(from.getTime()) ? from : parseCalendarDate(from))
    || (anchor && !Number.isNaN(anchor.getTime()) ? anchor : getLastMondayDate());
  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7 - 1);
  return { calendarFrom: calendarDateKey(start), calendarTo: calendarDateKey(end) };
};

export const buildScheduleWeekCalendar = (schedule, language, options = {}) => {
  if (!options.includeWeekCalendar) return null;
  const defaults = getScheduleExportCalendarRange(schedule);
  const from = parseCalendarDate(options.calendarFrom ?? defaults.calendarFrom);
  const to = parseCalendarDate(options.calendarTo ?? defaults.calendarTo);
  const span = from && to ? Math.round((to - from) / 86400000) : -1;
  if (span < 0 || span >= 366) throw new Error("invalid_week_calendar_range");
  const anchor = schedule?.starting_week ? new Date(schedule.starting_week) : null;
  if (!anchor || Number.isNaN(anchor.getTime())) throw new Error("week_calendar_missing_anchor");
  const lang = normalizeLanguage(language);
  const dateFormat = new Intl.DateTimeFormat(getLocale(lang), { day: "2-digit", month: "short", year: "numeric" });
  const rows = [];
  for (let date = new Date(from); date <= to; date.setDate(date.getDate() + 1)) {
    if (!rows.length || date.getDay() === anchor.getDay()) {
      const week = calculateScheduleWeek(schedule, date);
      rows.push({ number: rows.length + 1, from: calendarDateKey(date), to: calendarDateKey(date), week, weekTitle: t("common.week", lang, { week }) });
    } else rows[rows.length - 1].to = calendarDateKey(date);
  }
  rows.forEach(row => { row.period = `${dateFormat.format(parseCalendarDate(row.from))} — ${dateFormat.format(parseCalendarDate(row.to))}`; });
  const cycleDate = new Intl.DateTimeFormat(getLocale(lang), { dateStyle: "long" }).format(anchor);
  return {
    title: t("share.week_calendar_title", lang),
    period: `${dateFormat.format(from)} — ${dateFormat.format(to)}`,
    description: t("share.week_calendar_basis", lang, { date: cycleDate, count: getScheduleWeekNumbers(schedule.repeat).length }),
    selectionNote: Array.isArray(options.selectedWeeks) && getScheduleWeekNumbers(schedule.repeat).some(week => !options.selectedWeeks.includes(week))
      ? t("share.week_calendar_selection_note", lang) : "",
    columns: [t("share.week_calendar_number", lang), t("share.week_calendar_period", lang), t("share.week_calendar_cycle", lang)],
    rows,
  };
};

export const getScheduleExportSettings = (overrides = {}) => {
  const options = { ...SCHEDULE_EXPORT_DEFAULTS, ...overrides };
  const layout = ["agenda", "combined"].includes(options.layout) ? options.layout : "grid";
  const orientation = ["portrait", "landscape"].includes(options.orientation)
    ? options.orientation : layout === "agenda" ? "portrait" : "landscape";
  const paper = options.paper === "letter" ? "letter" : "a4";
  const dimensions = paper === "letter" ? [612, 792] : [595.28, 841.89];
  const density = ["compact", "large"].includes(options.density) ? options.density : "comfortable";
  return {
    layout, orientation, paper, density,
    fontSize: density === "compact" ? 9 : density === "large" ? 12 : 10,
    width: dimensions[orientation === "landscape" ? 1 : 0],
    height: dimensions[orientation === "landscape" ? 0 : 1],
    color: options.color !== "mono", fullUrls: options.linkStyle === "full",
    showNumbers: options.showNumbers !== false, showEmptyDays: options.showEmptyDays === true,
    csvSeparator: options.csvSeparator === "semicolon" ? ";" : options.csvSeparator === "tab" ? "\t" : ",",
  };
};

export const buildScheduleExport = (schedule, language, options = {}) => {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)
    || (schedule.schedule != null && !Array.isArray(schedule.schedule))) throw new Error("invalid_schedule");
  const lang = normalizeLanguage(language);
  const settings = getScheduleExportSettings(options);
  const grid = schedule.schedule || [];
  const subjects = new Map((schedule.subjects || []).map((item) => [item.id, item]));
  const teachers = new Map((schedule.teachers || []).map((item) => [item.id, item]));
  const links = new Map((schedule.links || []).map((item) => [item.id, item]));
  const weekday = new Intl.DateTimeFormat(getLocale(lang), { weekday: "long", timeZone: "UTC" });
  const startDate = schedule.starting_week ? new Date(schedule.starting_week) : null;
  const cycleStart = options.showCycleStart !== false && startDate && !Number.isNaN(startDate.getTime())
    ? t("share.cycle_start", lang, { date: new Intl.DateTimeFormat(getLocale(lang), { dateStyle: "long" }).format(startDate) }) : "";
  const weekNumbers = getScheduleWeekNumbers(schedule.repeat).filter((week) => (
    !Array.isArray(options.selectedWeeks) || options.selectedWeeks.includes(week)
  ));
  if (!weekNumbers.length) throw new Error("no_export_weeks");
  const weeks = weekNumbers.map((week) => ({
    number: week, title: t("common.week", lang, { week }),
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      index: dayIndex,
      title: capitalize(weekday.format(new Date(Date.UTC(2024, 0, 1 + dayIndex)))),
      lessons: buildDayTimeline(schedule, Array.isArray(grid[dayIndex]?.[`week${week}`]) ? grid[dayIndex][`week${week}`] : [])
        .filter((entry) => entry.type === "lesson").map(({ lesson }) => {
          const subject = subjects.get(lesson.subjectId) || {};
          const instance = lesson.data;
          const teacherIds = asList(instance.teachers ?? instance.teacher ?? subject.teachers ?? subject.teacher);
          const linkIds = asList(instance.links ?? instance.link ?? subject.links ?? subject.link);
          const lessonLinks = options.shareLinks !== false ? linkIds.flatMap((id) => {
            const link = links.get(id);
            const url = link && getLinkOpenUrl(link);
            if (!url || !/^https?:\/\//i.test(url)) return [];
            let host;
            try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return []; }
            const label = text(link.label || link.name) || (host === "zoom.us" || host.endsWith(".zoom.us") ? "Zoom" : host);
            return [{ url, label, display: settings.fullUrls ? url : label }];
          }) : [];
          const typeValue = text(instance.type ?? subject.type);
          const typeKey = "schedule.lesson_types." + typeValue;
          const translatedType = typeValue ? t(typeKey, lang) : "";
          const type = options.shareTypes !== false ? translatedType === typeKey ? typeValue : translatedType : "";
          const location = options.shareLocations !== false
            ? [text(instance.building ?? subject.building), text(instance.room ?? subject.room)].filter(Boolean).join(", ") : "";
          const teacher = options.shareTeachers !== false ? teacherIds.map((id) => text(teachers.get(id)?.name)).filter(Boolean).join(", ") : "";
          const note = options.shareNotes === true ? text(instance.note ?? subject.note) : "";
          return {
            start: lesson.timeInfo.start, end: lesson.timeInfo.end,
            time: `${lesson.timeInfo.start} – ${lesson.timeInfo.end}`, number: lesson.slotNumber,
            title: text(subject.name) || t("common.subject", lang),
            type, location, teacher, note, links: lessonLinks,
            details: [type, location, teacher, note].filter(Boolean),
          };
        }),
    })),
  }));
  const activeDays = new Set(weeks.flatMap((week) => week.days.filter((day) => day.lessons.length).map((day) => day.index)));
  if (!settings.showEmptyDays && activeDays.size) weeks.forEach((week) => { week.days = week.days.filter((day) => activeDays.has(day.index)); });
  const excludedColumns = { lesson_number: !settings.showNumbers, lesson_type: options.shareTypes === false,
    location: options.shareLocations === false, teacher: options.shareTeachers === false,
    links: options.shareLinks === false, notes: options.shareNotes !== true };
  return {
    title: text(schedule.name) || t("common.schedule", lang),
    author: options.shareAuthorName ? text(options.authorName) : "",
    cycleStart, lang, settings, weeks, empty: t("share.no_classes", lang),
    weekCalendar: buildScheduleWeekCalendar(schedule, lang, options),
    columns: [t("share.time", lang), t("common.subject", lang), t("share.details", lang)],
    csvColumns: ["week_column", "day", "start", "end", "lesson_number", "subject", "lesson_type", "location", "teacher", "links", "notes"]
      .filter((key) => !excludedColumns[key]).map((key) => ({ key, title: t("share." + key, lang) })),
  };
};

export const getScheduleExportRows = (week) => {
  const times = new Map();
  week.days.forEach((day) => day.lessons.forEach((lesson) => times.set(lesson.time, { time: lesson.time, start: lesson.start, end: lesson.end })));
  return [...times.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
    .map((row) => ({ ...row, cells: week.days.map((day) => day.lessons.filter((lesson) => lesson.time === row.time)) }));
};

export const getScheduleExportSections = (document) => {
  if (document.settings.layout !== "combined") return document.weeks;
  const sections = [];
  for (let index = 0; index < document.weeks.length; index += 2) {
    const weeks = document.weeks.slice(index, index + 2);
    if (weeks.length === 1) { sections.push(weeks[0]); continue; }
    sections.push({
      title: t("share.week_pair", document.lang, { first: weeks[0].number, second: weeks[1].number }),
      weeks,
      days: weeks[0].days.map(day => ({ ...day, lessons: weeks.flatMap(week => week.days.find(item => item.index === day.index)?.lessons || []) })),
    });
  }
  return sections;
};

export const getScheduleExportCombinedRows = (section) => getScheduleExportRows(section).flatMap(row => {
  const cells = section.days.map(day => {
    const variants = section.weeks.map(week => (
      week.days.find(item => item.index === day.index)?.lessons.filter(lesson => lesson.time === row.time) || []
    ));
    return { variants, shared: JSON.stringify(variants[0]) === JSON.stringify(variants[1]) };
  });
  const split = cells.some(cell => !cell.shared);
  return (split ? section.weeks : section.weeks.slice(0, 1)).map((week, index) => ({
    start: row.start, end: row.end,
    weeks: split ? [week.number] : section.weeks.map(item => item.number),
    timeRowSpan: index ? 0 : split ? 2 : 1,
    cells: cells.map(cell => ({
      rowSpan: split && cell.shared ? index ? 0 : 2 : 1,
      shared: cell.shared,
      lessons: cell.shared && index ? [] : cell.variants[index],
    })),
  }));
});

export const getScheduleExportRecords = (document) => document.weeks.flatMap((week) => week.days.flatMap((day) => day.lessons.map((lesson) => ({
  week_column: week.number, day: day.title, start: lesson.start, end: lesson.end,
  lesson_number: lesson.number || "", subject: lesson.title, lesson_type: lesson.type,
  location: lesson.location, teacher: lesson.teacher, links: lesson.links, notes: lesson.note,
}))));

export const scheduleExportToText = (document) => [
  document.title, document.author, document.cycleStart,
  ...document.weeks.flatMap((week) => ["", week.title, ...week.days.flatMap((day) => (
    !document.settings.showEmptyDays && !day.lessons.length ? [] : ["", day.title,
      ...(day.lessons.length ? day.lessons.map((lesson) => [
        `${document.settings.showNumbers && lesson.number ? lesson.number + ". " : ""}${lesson.time} · ${lesson.title}`,
        ...lesson.details.map((detail) => `  ${detail}`), ...lesson.links.map((link) => `  ${link.label}: ${link.url}`),
      ].join("\n")) : [document.empty]),
    ]
  )), ...(!week.days.some((day) => day.lessons.length) && !document.settings.showEmptyDays ? [document.empty] : [])]),
].filter((line) => line !== undefined && line !== null).join("\n");

export const scheduleExportToCsv = (document) => {
  const cell = (value) => {
    const safe = /^[\s\uFEFF]*[=+@\-]/.test(value) ? `'${value}` : value;
    return `"${String(safe).replace(/"/g, '""')}"`;
  };
  const rows = [document.csvColumns.map((column) => column.title)];
  getScheduleExportRecords(document).forEach((record) => rows.push(document.csvColumns.map((column) => (
    column.key === "links" ? record.links.map((link) => link.url).join("\n") : record[column.key]
  ))));
  return "\uFEFF" + rows.map((row) => row.map(cell).join(document.settings.csvSeparator)).join("\r\n");
};

export const scheduleExportToHtml = (document) => {
  const { settings } = document;
  const brand = getDocumentBranding(settings.color);
  const lines = (value) => escapeHtml(value).replace(/\n/g, "<br>");
  const card = (lesson) => `<div class="lesson"><div class="subject">${settings.showNumbers && lesson.number ? `<span class="number">${lesson.number}</span> ` : ""}${lines(lesson.title)}</div>
${lesson.type ? `<div class="type">${lines(lesson.type)}</div>` : ""}
${lesson.location ? `<div class="detail">${escapeHtml(t("share.location", document.lang))}: ${lines(lesson.location)}</div>` : ""}
${lesson.teacher ? `<div class="detail">${lines(lesson.teacher)}</div>` : ""}
${lesson.note ? `<div class="note">${lines(lesson.note)}</div>` : ""}
${lesson.links.map((link) => `<a href="${escapeHtml(link.url)}">${lines(link.display)}</a>`).join("<br>")}</div>`;
  const masthead = `<header><div class="brand"><span>${escapeHtml(t("common.schedule", document.lang))}</span><img src="${brand.image}" alt="${brand.name}" width="${brand.width}" height="${brand.height}"></div><h1>${lines(document.title)}</h1>
${document.author || document.cycleStart ? `<p class="meta">${[document.author, document.cycleStart].filter(Boolean).map(lines).join(" · ")}</p>` : ""}</header>`;
  const grid = (week) => {
    const rows = getScheduleExportRows(week);
    return rows.length ? `<table class="grid"><colgroup><col style="width:76pt">${week.days.map(() => "<col>").join("")}</colgroup><thead><tr><th scope="col"><small>${escapeHtml(week.title)}</small><br>${escapeHtml(document.columns[0])}</th>${week.days.map((day) => `<th scope="col">${escapeHtml(day.title)}</th>`).join("")}</tr></thead><tbody>
${rows.map((row) => `<tr><th scope="row" class="time">${row.start}<br><span>${row.end}</span></th>${row.cells.map((lessons) => `<td>${lessons.length ? lessons.map(card).join("") : '<span class="dash">—</span>'}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<p class="empty">${escapeHtml(document.empty)}</p>`;
  };
  const combinedGrid = (section) => {
    const rows = getScheduleExportCombinedRows(section);
    return rows.length ? `<table class="grid combined"><colgroup><col style="width:64pt"><col style="width:42pt">${section.days.map(() => "<col>").join("")}</colgroup><thead><tr><th scope="col">${escapeHtml(document.columns[0])}</th><th scope="col">${escapeHtml(t("share.week_column", document.lang))}</th>${section.days.map(day => `<th scope="col">${escapeHtml(day.title)}</th>`).join("")}</tr></thead>
${rows.map(row => `${row.timeRowSpan ? '<tbody class="time-group">' : ""}<tr>${row.timeRowSpan ? `<th scope="row" rowspan="${row.timeRowSpan}" class="time">${row.start}<br><span>${row.end}</span></th>` : ""}<th scope="row" class="cycle-week">${row.weeks.join(", ")}</th>${row.cells.map(cell => cell.rowSpan ? `<td rowspan="${cell.rowSpan}" class="${!cell.shared ? "week-specific" : ""}">${cell.lessons.length ? cell.lessons.map(card).join("") : '<span class="dash">—</span>'}</td>` : "").join("")}</tr>${row.timeRowSpan === 2 ? "" : "</tbody>"}`).join("")}</table>` : `<p class="empty">${escapeHtml(document.empty)}</p>`;
  };
  const agenda = (week) => week.days.map((day) => !settings.showEmptyDays && !day.lessons.length ? "" : `<section class="day">${day.lessons.length
    ? `<table class="agenda"><colgroup><col style="width:100pt"><col></colgroup><thead><tr><th colspan="2"><h3>${escapeHtml(day.title)}<span>${escapeHtml(week.title)} · ${lines(document.title)}</span></h3></th></tr></thead><tbody>${day.lessons.map((lesson) => `<tr><th scope="row" class="time">${lesson.start}<br><span>${lesson.end}</span></th><td>${card(lesson)}</td></tr>`).join("")}</tbody></table>`
    : `<h3>${escapeHtml(day.title)}</h3><p class="empty">${escapeHtml(document.empty)}</p>`}</section>`).join("") || `<p class="empty">${escapeHtml(document.empty)}</p>`;
  const calendar = document.weekCalendar;
  const calendarHtml = calendar ? `<section class="week week-calendar">${masthead}<h2>${escapeHtml(calendar.title)}</h2><p class="calendar-period">${escapeHtml(calendar.period)}</p><p class="meta">${escapeHtml(calendar.description)}</p>
${calendar.selectionNote ? `<p class="meta">${escapeHtml(calendar.selectionNote)}</p>` : ""}<table><colgroup><col style="width:36pt"><col><col style="width:120pt"></colgroup><thead><tr>${calendar.columns.map(title => `<th scope="col">${escapeHtml(title)}</th>`).join("")}</tr></thead><tbody>
${calendar.rows.map(row => `<tr><td>${row.number}</td><td>${escapeHtml(row.period)}</td><th scope="row" class="cycle-week ${row.week % 2 ? "cycle-odd" : ""}">${escapeHtml(row.weekTitle)}</th></tr>`).join("")}</tbody></table></section>` : "";
  return `<!DOCTYPE html><html lang="${document.lang}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${escapeHtml(document.title)}</title><style>
@page { size: ${settings.width}pt ${settings.height}pt; margin: 10mm 12mm; }
* { box-sizing: border-box; } body { font: ${settings.fontSize}pt/1.35 Arial, sans-serif; color: #172536; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
header { margin-bottom: 8pt; } .brand { display: flex; align-items: center; justify-content: space-between; font-size: 8pt; line-height: 1.2; border-bottom: .5pt solid ${settings.color ? "#D9E1E8" : "#DDD"}; padding-bottom: 4pt; margin-bottom: 5pt; } .brand img { width: ${brand.width}pt; height: ${brand.height}pt; }
.brand span { color: #637184; letter-spacing: 1pt; text-transform: uppercase; } h1 { color: #172536; font-size: 22pt; line-height: 1.15; margin: 5pt 0 4pt; overflow-wrap: anywhere; }
.meta { color: #536174; font-size: 8.5pt; margin: 4pt 0 0; } h2 { font-size: 14pt; line-height: 1.2; margin: 0 0 6pt; } h3 { font-size: 12pt; margin: 14pt 0 5pt; break-after: avoid; }
.week + .week { break-before: page; } .week-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 16pt; } .week-heading span { font-size: 9pt; color: #637184; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; } th,td { vertical-align: top; text-align: left; border: .6pt solid #D9E1E8; padding: ${settings.density === "compact" ? 5 : settings.density === "large" ? 9 : 6}pt; overflow-wrap: anywhere; }
thead th { background: ${settings.color ? "#EAF3F5" : "#EEEEEE"}; font-weight: 700; font-size: 9.5pt; padding: 9pt 7pt; } thead { display: table-header-group; }
tr,.time-group { break-inside: avoid; } .time { background: #F5F7F9; font-size: 10pt; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; } .time span { color: #637184; font-weight: 400; }
.week-specific { background: ${settings.color ? "#F3F8FA" : "#FAFAFA"}; }
.subject { font-weight: 700; line-height: 1.2; } .number { color: ${settings.color ? "#176B78" : "#4B4B4B"}; font-size: 8pt; } .detail,.type { font-size: .9em; color: #46566A; margin-top: 3pt; } .type { font-style: italic; }
.lesson + .lesson { border-top: .6pt solid #D9E1E8; padding-top: 7pt; margin-top: 7pt; } .note { font-size: .9em; margin-top: 6pt; white-space: normal; } a { display: inline-block; color: ${settings.color ? "#086A85" : "#303030"}; text-decoration: underline; margin-top: 3pt; font-size: .9em; overflow-wrap: anywhere; }
.dash,.empty { color: #637184; } .dash { font-size: 12pt; } .agenda td,.agenda th { border-left: 0; border-right: 0; } .agenda thead th { background: white; border: 0; padding: 12pt 0 5pt; } .agenda h3 { margin: 0; display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; } .agenda h3 span { font-size: 8pt; font-weight: 400; color: #637184; }
.calendar-period { font-size: 10pt; color: ${settings.color ? "#176B78" : "#333"}; margin: 5pt 0; } .week-calendar table { margin-top: 10pt; } .week-calendar th,.week-calendar td { padding: 4pt 6pt; font-size: ${settings.fontSize}pt; } .cycle-week { color: ${settings.color ? "#176B78" : "#333"}; background: ${settings.color ? "#F3F6F9" : "#F8F8F8"}; } .cycle-odd { background: ${settings.color ? "#EAF3F5" : "#EEE"}; }
${!settings.color ? "body,h1,h2,h3 { color: #222; } .meta,.detail,.type,.time span,.brand span,.empty,.dash,.week-heading span { color: #555; } .time { background: #F5F5F5; } th,td,.lesson + .lesson { border-color: #DDD; }" : ""}
</style></head><body>${getScheduleExportSections(document).map((week) => `<section class="week">${masthead}<div class="week-heading"><h2>${escapeHtml(week.title)}</h2><span>${escapeHtml(t("share.lesson_count", document.lang, { count: week.days.reduce((sum, day) => sum + day.lessons.length, 0) }))}</span></div>
${week.weeks ? combinedGrid(week) : settings.layout !== "agenda" ? grid(week) : agenda(week)}</section>`).join("")}${calendarHtml}</body></html>`;
};
