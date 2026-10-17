import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { buildScheduleExport, getScheduleExportRows, getScheduleExportSections, getScheduleExportCombinedRows, scheduleExportToCsv, scheduleExportToText } from "../utils/scheduleExport";
import { createScheduleSpreadsheet } from "../utils/scheduleSpreadsheet";
import { t } from "../utils/i18n";
import { generateId } from "../utils/idGenerator";
import { downloadWebFile, shareLocalFile, SHARED_FILE_CACHE_DIR } from "./fileSharingService";
import { exportSchedulePdf } from "./schedulePdfService";
import { DOCUMENT_BRAND_NAME, getDocumentBranding } from "../config/documentBranding";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const createScheduleWordDocument = async (document) => {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, Packer,
    ExternalHyperlink, Footer, PageNumber, TableLayoutType, BorderStyle, ImageRun, TabStopType } = require("docx");
  const { settings } = document;
  const brand = getDocumentBranding(settings.color);
  const brandImage = () => new ImageRun({ type: "png", data: brand.image,
    transformation: { width: brand.width * 96 / 72, height: brand.height * 96 / 72 },
    altText: { name: brand.name, title: brand.name, description: brand.name },
  });
  const accent = settings.color ? "176B78" : "303030";
  const fontSize = settings.fontSize * 2;
  const paragraph = (value, options = {}, run = {}) => new Paragraph({
    children: String(value).split("\n").map((line, index) => new TextRun({ text: line, ...(index ? { break: 1 } : {}), ...run,
      ...(!settings.color && run.color ? { color: run.color === "172536" ? "222222" : "555555" } : {}) })),
    spacing: { after: 40 }, ...options,
  });
  const lessonContent = (lesson) => [
    paragraph(`${settings.showNumbers && lesson.number ? lesson.number + ". " : ""}${lesson.title}`, {}, { bold: true }),
    ...(lesson.type ? [paragraph(lesson.type, {}, { italics: true, color: "46566A", size: fontSize - 2 })] : []),
    ...(lesson.location ? [paragraph(`${t("share.location", document.lang)}: ${lesson.location}`, {}, { color: "46566A", size: fontSize - 2 })] : []),
    ...(lesson.teacher ? [paragraph(lesson.teacher, {}, { color: "46566A", size: fontSize - 2 })] : []),
    ...(lesson.note ? [paragraph(lesson.note)] : []),
    ...lesson.links.map((link) => new Paragraph({ spacing: { before: 60, after: 60 }, children: [new ExternalHyperlink({
      link: link.url, children: [new TextRun({ text: link.display, style: "Hyperlink", color: accent, underline: {}, size: fontSize - 2 })],
    })] })),
  ];
  const cell = (children, header = false, time = false, rowSpan = 1) => new TableCell({
    children, rowSpan, margins: { top: settings.density === "compact" ? 90 : settings.density === "large" ? 150 : 120,
      bottom: settings.density === "compact" ? 90 : settings.density === "large" ? 150 : 120, left: 110, right: 110 },
    ...(header || time ? { shading: { fill: header ? settings.color ? "EAF3F5" : "EEEEEE" : settings.color ? "F5F7F9" : "F5F5F5" } } : {}),
  });
  const timeCell = (start, end, rowSpan = 1) => cell([
    paragraph(start, {}, { bold: true, size: 20 }), paragraph(end, {}, { color: "637184", size: 20 }),
  ], false, true, rowSpan);
  const contentWidth = Math.round(settings.width * 20) - 1360;
  const border = { style: BorderStyle.SINGLE, size: 4, color: settings.color ? "D9E1E8" : "DDDDDD" };
  const table = (widths, rows) => new Table({
    width: { size: contentWidth, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: widths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }, rows,
  });
  const children = [];
  getScheduleExportSections(document).forEach((week, weekIndex) => {
    children.push(new Paragraph({ children: [
      new TextRun({ text: t("common.schedule", document.lang).toLocaleUpperCase(document.lang), size: 16, color: settings.color ? "637184" : "555555" }),
      new TextRun({ text: "\t" }), brandImage()],
      tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
      border: { bottom: { color: settings.color ? "D9E1E8" : "DDDDDD", size: 4, style: BorderStyle.SINGLE, space: 4 } },
      pageBreakBefore: weekIndex > 0, keepNext: true, spacing: { after: 100 },
    }));
    children.push(paragraph(document.title, { heading: HeadingLevel.TITLE, keepNext: true }, { color: "172536", size: 44, bold: true }));
    const meta = [document.author, document.cycleStart].filter(Boolean).join(" · ");
    if (meta) children.push(paragraph(meta, { keepNext: true, spacing: { after: 160 } }, { color: "536174", size: 18 }));
    children.push(paragraph(week.title, { heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 120, after: 160 } }, { color: "172536", size: 30, bold: true }));
    if (week.weeks) {
      const rows = getScheduleExportCombinedRows(week);
      if (!rows.length) { children.push(paragraph(document.empty)); return; }
      const timeWidth = 1200;
      const weekWidth = 840;
      const dayWidth = Math.floor((contentWidth - timeWidth - weekWidth) / week.days.length);
      const widths = [timeWidth, weekWidth, ...week.days.map((_, index) => index === week.days.length - 1 ? contentWidth - timeWidth - weekWidth - dayWidth * index : dayWidth)];
      children.push(table(widths, [
        new TableRow({ tableHeader: true, children: [document.columns[0], t("share.week_column", document.lang), ...week.days.map(day => day.title)]
          .map(title => cell([paragraph(title, {}, { bold: true, size: 18 })], true)) }),
        ...rows.map(row => new TableRow({ cantSplit: !row.cells.some(item => item.lessons.some(lesson => lesson.note.length > 600)), children: [
          ...(row.timeRowSpan ? [timeCell(row.start, row.end, row.timeRowSpan)] : []),
          cell([paragraph(row.weeks.join(", "), { alignment: "center" }, { bold: true, size: 18, color: accent })], true),
          ...row.cells.filter(item => item.rowSpan).map(item => cell(item.lessons.length ? item.lessons.flatMap(lessonContent)
            : [paragraph("—", {}, { color: "637184" })], false, false, item.rowSpan)),
        ] })),
      ]));
    } else if (settings.layout !== "agenda") {
      const rows = getScheduleExportRows(week);
      if (!rows.length) { children.push(paragraph(document.empty)); return; }
      const timeWidth = 1400;
      const dayWidth = Math.floor((contentWidth - timeWidth) / week.days.length);
      const widths = [timeWidth, ...week.days.map((_, index) => index === week.days.length - 1 ? contentWidth - timeWidth - dayWidth * index : dayWidth)];
      children.push(table(widths, [
        new TableRow({ tableHeader: true, children: [week.title + "\n" + document.columns[0], ...week.days.map((day) => day.title)]
          .map((title) => cell([paragraph(title, {}, { bold: true, size: 19 })], true)) }),
        ...rows.map((row) => new TableRow({ cantSplit: !row.cells.some((lessons) => lessons.some((lesson) => lesson.note.length > 600)), children: [timeCell(row.start, row.end),
          ...row.cells.map((lessons) => cell(lessons.length ? lessons.flatMap(lessonContent) : [paragraph("—", {}, { color: "637184" })])),
        ] })),
      ]));
    } else {
      let hasContent = false;
      week.days.forEach((day) => {
        if (!settings.showEmptyDays && !day.lessons.length) return;
        hasContent = true;
        children.push(paragraph(day.title, { heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 220, after: 100 } }, { size: 24, color: accent, bold: true }));
        if (!day.lessons.length) { children.push(paragraph(document.empty)); return; }
        children.push(table([1800, contentWidth - 1800], [
          new TableRow({ tableHeader: true, children: [document.columns[0], day.title + " · " + week.title].map((title) => cell([paragraph(title, {}, { bold: true, size: 19 })], true)) }),
          ...day.lessons.map((lesson) => new TableRow({ cantSplit: lesson.note.length <= 600,
          children: [timeCell(lesson.start, lesson.end), cell(lessonContent(lesson))],
        }))]));
      });
      if (!hasContent) children.push(paragraph(document.empty));
    }
  });
  if (document.weekCalendar) {
    const calendar = document.weekCalendar;
    children.push(
      paragraph(calendar.title, { pageBreakBefore: true, heading: HeadingLevel.HEADING_1, keepNext: true }, { size: 36, bold: true, color: "172536" }),
      paragraph(document.title, { keepNext: true }, { size: 24, bold: true }),
      paragraph(calendar.period, { keepNext: true }, { size: 20, color: accent }),
      paragraph(calendar.description, { keepNext: true, spacing: { after: 160 } }, { size: 18, color: "536174" }),
      ...(calendar.selectionNote ? [paragraph(calendar.selectionNote, { keepNext: true }, { size: 18, color: "536174" })] : []),
      table([800, contentWidth - 3400, 2600], [
        new TableRow({ tableHeader: true, children: calendar.columns.map(title => cell([paragraph(title, {}, { bold: true, size: 19 })], true)) }),
        ...calendar.rows.map(row => new TableRow({ cantSplit: true, children: [
          cell([paragraph(row.number, {}, { color: "637184" })]), cell([paragraph(row.period)]),
          cell([paragraph(row.weekTitle, {}, { bold: true, color: accent })]),
        ] })),
      ]),
    );
  }
  // docx swaps the base page dimensions when landscape is selected.
  const file = new Document({
    creator: DOCUMENT_BRAND_NAME, title: document.title,
    styles: { default: { document: { run: { font: "Arial", size: fontSize, color: settings.color ? "172536" : "222222", language: { value: document.lang === "uk" ? "uk-UA" : "en-US" } },
      paragraph: { spacing: { after: 60 } } } } },
    sections: [{ properties: { page: { size: {
      width: Math.round(Math.min(settings.width, settings.height) * 20),
      height: Math.round(Math.max(settings.width, settings.height) * 20), orientation: settings.orientation,
    },
      margin: { top: 560, bottom: 560, left: 680, right: 680, footer: 260 } } },
      footers: { default: new Footer({ children: [new Paragraph({ children: [
        new TextRun({ text: `${document.title}    `, size: 16, color: settings.color ? "637184" : "555555" }),
        new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 16, color: settings.color ? "637184" : "555555" }),
      ] })] }) }, children }],
  });
  return Packer.toBase64String(file);
};

export const exportSchedule = async (schedule, format, lang, options = {}) => {
  if (!["pdf", "docx", "xlsx", "csv", "text"].includes(format)) throw new Error("unsupported_export_format");
  const document = buildScheduleExport(schedule, lang, options);
  if (format === "text") {
    const message = scheduleExportToText(document);
    if (Platform.OS === "web") {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: document.title, text: message });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
          if (!["NotAllowedError", "NotSupportedError", "SecurityError", "InvalidStateError"].includes(error?.name)) throw error;
        }
      }
      downloadWebFile(message, `PlanIt-${document.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80)}.txt`, "text/plain;charset=utf-8");
    } else await Share.share({ message, title: document.title });
    return;
  }
  const fileName = `PlanIt-${document.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80)}.${format}`;
  if (format === "pdf") {
    await exportSchedulePdf(document, fileName);
    return;
  }
  if (Platform.OS !== "web" && !(await Sharing.isAvailableAsync())) throw new Error("sharing_unavailable");
  const content = format === "docx" ? await createScheduleWordDocument(document)
    : format === "xlsx" ? await createScheduleSpreadsheet(document) : scheduleExportToCsv(document);
  const binaryFormat = format === "docx" || format === "xlsx";
  const mimeType = format === "docx" ? DOCX_MIME : format === "xlsx" ? XLSX_MIME : "text/csv";
  if (Platform.OS === "web") {
    const bytes = binaryFormat ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0)) : content;
    downloadWebFile(bytes, fileName, mimeType);
    return;
  }
  if (!SHARED_FILE_CACHE_DIR) throw new Error("cache_unavailable");
  const directory = `${SHARED_FILE_CACHE_DIR}${Date.now()}-${generateId()}/`;
  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const uri = directory + fileName;
    await FileSystem.writeAsStringAsync(uri, content, { encoding: binaryFormat ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8 });
    await shareLocalFile({
      uri,
      name: fileName,
      mimeType,
      uti: format === "docx" ? "org.openxmlformats.wordprocessingml.document"
        : format === "xlsx" ? "org.openxmlformats.spreadsheetml.sheet" : "public.comma-separated-values-text",
    });
  } finally {
    await FileSystem.deleteAsync(directory, { idempotent: true });
  }
};
