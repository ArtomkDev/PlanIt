import { getScheduleExportRows, getScheduleExportSections, getScheduleExportCombinedRows } from "../utils/scheduleExport";
import { t } from "../utils/i18n";
import { downloadWebFile } from "./fileSharingService";
import { DOCUMENT_BRAND_NAME, getDocumentBranding } from "../config/documentBranding";

export const createSchedulePdfDocument = async (document) => {
  const pdfMake = require("pdfmake/build/pdfmake");
  pdfMake.addVirtualFileSystem(require("pdfmake/build/vfs_fonts"));
  const { settings, lang } = document;
  const brand = getDocumentBranding(settings.color);
  const accent = settings.color ? "#176B78" : "#303030";
  const muted = settings.color ? "#536174" : "#555555";
  const border = settings.color ? "#D9E1E8" : "#DDDDDD";
  const padding = settings.density === "compact" ? 4 : settings.density === "large" ? 8 : 5;
  const noteReferences = new Map();
  document.weeks.forEach((week) => week.days.forEach((day) => day.lessons.forEach((lesson) => {
    if (lesson.note.length > 600) noteReferences.set(lesson, `note-${noteReferences.size + 1}`);
  })));
  const lessonContent = (lesson) => [
    { text: `${settings.showNumbers && lesson.number ? lesson.number + ". " : ""}${lesson.title}`, bold: true },
    ...(lesson.type ? [{ text: lesson.type, style: "detail", italics: true }] : []),
    ...(lesson.location ? [{ text: `${t("share.location", lang)}: ${lesson.location}`, style: "detail" }] : []),
    ...(lesson.teacher ? [{ text: lesson.teacher, style: "detail" }] : []),
    ...(lesson.note ? [noteReferences.has(lesson)
      ? { text: t("share.notes", lang) + " →", linkToDestination: noteReferences.get(lesson), color: accent, decoration: "underline", margin: [0, 5, 0, 0] }
      : { text: lesson.note, margin: [0, 5, 0, 0] }] : []),
    ...lesson.links.map((link) => ({ text: link.display, link: link.url, wordBreak: settings.fullUrls ? "break-all" : "normal",
      color: accent, decoration: "underline", fontSize: settings.fontSize * 0.9, margin: [0, 3, 0, 0] })),
  ];
  const timeCell = (lesson) => ({ stack: [
    { text: lesson.start, bold: true }, { text: lesson.end, color: muted },
  ], fontSize: 10, fillColor: settings.color ? "#F5F7F9" : "#F5F5F5" });
  const table = (widths, body, grid, lessons, headerRows = 1) => {
    const breakRows = lessons.some((lesson) => [lesson.title, lesson.type, lesson.location, lesson.teacher,
      noteReferences.has(lesson) ? "" : lesson.note, ...lesson.links.map((link) => link.display)].join(" ").length > 500);
    return {
      table: { widths: [...widths], headerRows, keepWithHeaderRows: headerRows && !breakRows ? 1 : 0, dontBreakRows: !breakRows, body },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => grid ? 0.5 : 0,
        hLineColor: () => border, vLineColor: () => border,
        paddingLeft: () => padding, paddingRight: () => padding,
        paddingTop: () => padding, paddingBottom: () => padding,
      },
    };
  };
  const content = [];
  getScheduleExportSections(document).forEach((week, weekIndex) => {
    const lessons = week.days.flatMap((day) => day.lessons);
    const combinedRows = week.weeks ? getScheduleExportCombinedRows(week) : null;
    content.push(
      { columns: [{ text: t("common.schedule", lang).toLocaleUpperCase(lang), color: muted, fontSize: 8, characterSpacing: 1, margin: [0, 1, 0, 0] },
        { image: brand.image, width: brand.width, height: brand.height }],
        ...(weekIndex ? { pageBreak: "before" } : {}), margin: [0, 0, 0, 4] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: settings.width - 68, y2: 0, lineWidth: 0.5, lineColor: border }], margin: [0, 0, 0, 5] },
      { text: document.title, bold: true, fontSize: 22, margin: [0, 0, 0, 5] },
      ...([document.author, document.cycleStart].some(Boolean) ? [{ text: [document.author, document.cycleStart].filter(Boolean).join(" · "), color: muted, fontSize: 8.5, margin: [0, 0, 0, 7] }] : []),
      { columns: [{ text: week.title, bold: true, fontSize: 14 },
        { text: t("share.lesson_count", lang, { count: lessons.length }), alignment: "right", color: muted, fontSize: 9 }], margin: [0, 3, 0, 9] },
    );
    if (combinedRows) {
      if (!combinedRows.length) { content.push({ text: document.empty, color: muted }); return; }
      const widths = [40, 40, ...week.days.map(() => "*")];
      const header = [document.columns[0], t("share.week_column", lang), ...week.days.map(day => day.title)]
        .map(text => ({ text, bold: true, fontSize: 9, fillColor: settings.color ? "#EAF3F5" : "#EEEEEE" }));
      const groups = [];
      combinedRows.forEach(row => {
        if (row.timeRowSpan) groups.push([]);
        groups[groups.length - 1].push([
          row.timeRowSpan ? { ...timeCell(row), rowSpan: row.timeRowSpan } : {},
          { text: row.weeks.join(", "), bold: true, alignment: "center", color: accent, fontSize: 9, fillColor: settings.color ? "#EAF3F5" : "#EEEEEE" },
          ...row.cells.map(cell => cell.rowSpan ? ({
            rowSpan: cell.rowSpan,
            ...(cell.lessons.length ? { stack: cell.lessons.flatMap(lessonContent) } : { text: "—", color: muted }),
            ...(!cell.shared ? { fillColor: settings.color ? "#F3F8FA" : "#FAFAFA" } : {}),
          }) : {}),
        ]);
      });
      const combinedTable = table(["*"], [
        [table(widths, [header], true, lessons, 0)],
        ...groups.map(rows => [table(widths, rows, true, lessons, 0)]),
      ], false, lessons);
      // Keep both week rows together while repeating the day header on each page.
      combinedTable.layout = {
        hLineWidth: () => 0, vLineWidth: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0,
      };
      content.push(combinedTable);
    } else if (settings.layout !== "agenda") {
      const rows = getScheduleExportRows(week);
      if (!rows.length) { content.push({ text: document.empty, color: muted }); return; }
      content.push(table([62, ...week.days.map(() => "*")], [
        [week.title + "\n" + document.columns[0], ...week.days.map((day) => day.title)].map((text) => ({ text, bold: true, fontSize: 9.5, fillColor: settings.color ? "#EAF3F5" : "#EEEEEE" })),
        ...rows.map((row) => [timeCell(row), ...row.cells.map((cell) => cell.length
          ? { stack: cell.map((lesson, index) => ({ stack: lessonContent(lesson), ...(index ? { margin: [0, 8, 0, 0] } : {}) })) }
          : { text: "—", color: muted })]),
      ], true, lessons));
    } else {
      let hasContent = false;
      week.days.forEach((day) => {
        if (!settings.showEmptyDays && !day.lessons.length) return;
        hasContent = true;
        if (!day.lessons.length) {
          content.push({ text: day.title, bold: true, color: accent, fontSize: 12, margin: [0, 10, 0, 5] }, { text: document.empty, color: muted });
          return;
        }
        content.push({ ...table([72, "*"], [
          [{ colSpan: 2, columns: [{ text: day.title, bold: true, fontSize: 12, color: accent },
            { text: `${week.title} · ${document.title}`, alignment: "right", color: muted, fontSize: 8 }] }, {}],
          ...day.lessons.map((lesson) => [timeCell(lesson), { stack: lessonContent(lesson) }]),
        ], false, day.lessons), margin: [0, 6, 0, 5] });
      });
      if (!hasContent) content.push({ text: document.empty, color: muted });
    }
    const visibleLessons = new Set(combinedRows ? combinedRows.flatMap(row => row.cells.flatMap(cell => cell.lessons)) : lessons);
    const notes = week.days.flatMap((day) => day.lessons.filter((lesson) => visibleLessons.has(lesson) && noteReferences.has(lesson)).map((lesson) => ({ day, lesson })));
    if (notes.length) {
      content.push({ text: `${t("share.notes", lang)} · ${week.title}`, pageBreak: "before", bold: true, fontSize: 14, color: accent, margin: [0, 0, 0, 12] });
      notes.forEach(({ day, lesson }) => content.push(
        { text: `${day.title} · ${lesson.time} · ${lesson.title}`, id: noteReferences.get(lesson), bold: true, margin: [0, 10, 0, 5] },
        { text: lesson.note, fontSize: settings.fontSize, margin: [0, 0, 0, 10] },
      ));
    }
  });
  if (document.weekCalendar) {
    const calendar = document.weekCalendar;
    content.push(
      { columns: [{ text: calendar.title, bold: true, fontSize: 18 }, { image: brand.image, width: brand.width, height: brand.height }], pageBreak: "before", margin: [0, 0, 0, 8] },
      { text: document.title, bold: true, fontSize: 12, margin: [0, 0, 0, 5] },
      { text: calendar.period, fontSize: 10, color: accent, margin: [0, 0, 0, 5] },
      { text: calendar.description, color: muted, fontSize: 8.5, margin: [0, 0, 0, 8] },
      ...(calendar.selectionNote ? [{ text: calendar.selectionNote, color: muted, fontSize: 8.5, margin: [0, 0, 0, 8] }] : []),
      table([32, "*", 140], [
        calendar.columns.map(text => ({ text, bold: true, fillColor: settings.color ? "#EAF3F5" : "#EEEEEE" })),
        ...calendar.rows.map(row => [
          { text: row.number, color: muted }, { text: row.period },
          { text: row.weekTitle, bold: true, color: accent, fillColor: row.week % 2 ? settings.color ? "#EAF3F5" : "#EEEEEE" : settings.color ? "#F3F6F9" : "#F8F8F8" },
        ]),
      ], true, []),
    );
  }
  const definition = {
    info: { title: document.title, author: document.author || "", creator: DOCUMENT_BRAND_NAME, producer: DOCUMENT_BRAND_NAME },
    pageSize: { width: settings.width, height: settings.height }, pageOrientation: settings.orientation,
    pageMargins: [34, 28, 34, 32],
    defaultStyle: { font: "Roboto", fontSize: settings.fontSize, lineHeight: 1.1, color: settings.color ? "#172536" : "#222222" },
    styles: { detail: { color: muted, fontSize: settings.fontSize * 0.9, margin: [0, 3, 0, 0] } },
    footer: (page, total) => ({ columns: [{ text: document.title.length > 80 ? document.title.slice(0, 77) + "…" : document.title, color: muted, fontSize: 8 },
      { text: `${page} / ${total}`, width: 56, color: muted, fontSize: 8, alignment: "right" }], margin: [34, 10, 34, 0] }),
    content,
  };
  return pdfMake.createPdf(definition).getBuffer();
};

export const exportSchedulePdf = async (document, fileName) => {
  const bytes = await createSchedulePdfDocument(document);
  downloadWebFile(bytes, fileName, "application/pdf");
};
