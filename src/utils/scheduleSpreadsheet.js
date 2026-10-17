import { t } from "./i18n";
import { getScheduleExportRecords } from "./scheduleExport";
import { getDocumentBranding } from "../config/documentBranding";

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const xml = (value) => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[char]));
const columnName = (index) => {
  let name = "";
  for (let number = index + 1; number; number = Math.floor((number - 1) / 26)) name = String.fromCharCode(65 + (number - 1) % 26) + name;
  return name;
};
const stringCell = (ref, value, style) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const numberCell = (ref, value, style) => `<c r="${ref}" s="${style}"><v>${value}</v></c>`;

export const createScheduleSpreadsheet = async (document) => {
  const JSZip = require("jszip");
  const zip = new JSZip();
  const brand = getDocumentBranding(document.settings.color);
  const calendar = document.weekCalendar;
  const records = getScheduleExportRecords(document);
  const maxLinks = Math.max(1, ...records.map((record) => record.links.length));
  const columns = document.csvColumns.flatMap((column) => column.key === "links"
    ? Array.from({ length: maxLinks }, (_, index) => ({ ...column, linkIndex: index, title: column.title + (maxLinks > 1 ? ` ${index + 1}` : "") })) : [column]);
  const widths = columns.map(({ key }) => ({ week_column: 10, day: 18, start: 11, end: 11, lesson_number: 11,
    subject: 43, lesson_type: 19, location: 22, teacher: 28, links: 24, notes: 48 })[key]);
  const lastColumn = columnName(columns.length - 1);
  const lastMetadataColumn = columnName(columns.length - 3);
  const firstBrandColumn = columnName(columns.length - 2);
  const relationships = [];
  const hyperlinks = [];
  const rows = [
    `<row r="1" ht="34" customHeight="1">${stringCell("A1", document.title, 1)}</row>`,
    `<row r="2" ht="26" customHeight="1">${stringCell("A2", [document.author, document.cycleStart].filter(Boolean).join(" · "), 9)}</row>`,
    `<row r="4" ht="32" customHeight="1">${columns.map((column, index) => stringCell(columnName(index) + "4", column.title, 2)).join("")}</row>`,
  ];
  records.forEach((record, index) => {
    const rowNumber = index + 5;
    let lineCount = 1;
    const cells = columns.map((column, columnIndex) => {
      const ref = columnName(columnIndex) + rowNumber;
      const link = column.key === "links" ? record.links[column.linkIndex] : null;
      const value = link ? link.display : column.key === "links" ? "" : record[column.key] ?? "";
      lineCount = Math.max(lineCount, String(value).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (widths[columnIndex] - 2))), 0));
      const stripe = index % 2;
      if (link) {
        const id = "link" + relationships.length;
        relationships.push(`<Relationship Id="${id}" Type="${REL_NS}/hyperlink" Target="${xml(link.url)}" TargetMode="External"/>`);
        hyperlinks.push(`<hyperlink ref="${ref}" r:id="${id}" tooltip="${xml(link.url)}"/>`);
        return stringCell(ref, value, 7 + stripe);
      }
      if (column.key === "start" || column.key === "end") {
        const [hours, minutes] = value.split(":").map(Number);
        return numberCell(ref, (hours * 60 + minutes) / 1440, 5 + stripe);
      }
      return typeof value === "number" ? numberCell(ref, value, 3 + stripe) : stringCell(ref, value, column.key === "subject" ? 10 + stripe : 3 + stripe);
    });
    rows.push(`<row r="${rowNumber}" ht="${Math.min(409, Math.max(34, lineCount * 15 + 12))}" customHeight="1">${cells.join("")}</row>`);
  });
  if (!records.length) rows.push(`<row r="5">${stringCell("A5", document.empty, 3)}</row>`);
  const lastRow = Math.max(5, records.length + 4);
  const sheet = `<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="34"/><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.join("")}</sheetData><autoFilter ref="A4:${lastColumn}${lastRow}"/><mergeCells count="3"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastMetadataColumn}2"/><mergeCell ref="${firstBrandColumn}2:${lastColumn}2"/></mergeCells>
${hyperlinks.length ? `<hyperlinks>${hyperlinks.join("")}</hyperlinks>` : ""}<printOptions horizontalCentered="1"/><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><drawing r:id="brandLogo"/></worksheet>`;
  const font = (extra = "", color = document.settings.color ? "172536" : "222222", size = 10) => `<font><sz val="${size}"/><color rgb="FF${color}"/><name val="Arial"/>${extra}</font>`;
  const xf = (fontId, fillId, numFmtId = 0) => `<xf fontId="${fontId}" fillId="${fillId}" borderId="0" numFmtId="${numFmtId}" xfId="0" applyAlignment="1"${numFmtId ? ' applyNumberFormat="1"' : ""}><alignment vertical="top" wrapText="1"/></xf>`;
  const styles = `<styleSheet xmlns="${MAIN_NS}"><numFmts count="${calendar ? 2 : 1}"><numFmt numFmtId="164" formatCode="hh:mm"/>${calendar ? '<numFmt numFmtId="165" formatCode="dd.mm.yyyy"/>' : ""}</numFmts>
<fonts count="5">${font()}${font("<b/>", "FFFFFF")}${font("<b/>", document.settings.color ? "172536" : "222222", 20)}${font("<u/>", document.settings.color ? "086A85" : "303030")}${font("<b/>")}</fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${document.settings.color ? "176B78" : "303030"}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${document.settings.color ? "F0F5F7" : "F5F5F5"}"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1">${xf(0, 0)}</cellStyleXfs>
<cellXfs count="${calendar ? 14 : 12}">${xf(0, 0)}${xf(2, 0)}${xf(1, 2)}${xf(0, 0)}${xf(0, 3)}${xf(0, 0, 164)}${xf(0, 3, 164)}${xf(3, 0)}${xf(3, 3)}${xf(0, 0)}${xf(4, 0)}${xf(4, 3)}${calendar ? xf(0, 0, 165) + xf(0, 3, 165) : ""}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${calendar ? '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' : ""}<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
  zip.file("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="workbook" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><bookViews><workbookView/></bookViews><sheets><sheet name="${xml(t("common.schedule", document.lang))}" sheetId="1" r:id="sheet"/>${calendar ? `<sheet name="${xml(calendar.title)}" sheetId="2" r:id="calendar"/>` : ""}</sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${xml(t("common.schedule", document.lang))}'!$4:$4</definedName>${calendar ? `<definedName name="_xlnm.Print_Titles" localSheetId="1">'${xml(calendar.title)}'!$5:$5</definedName>` : ""}</definedNames></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="sheet" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>${calendar ? `<Relationship Id="calendar" Type="${REL_NS}/worksheet" Target="worksheets/sheet2.xml"/>` : ""}<Relationship Id="styles" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", styles);
  zip.file("xl/worksheets/sheet1.xml", sheet);
  if (calendar) {
    const calendarRows = [
      `<row r="1" ht="32" customHeight="1">${stringCell("A1", calendar.title, 1)}</row>`,
      `<row r="2" ht="24" customHeight="1">${stringCell("A2", calendar.period, 9)}</row>`,
      `<row r="3" ht="48" customHeight="1">${stringCell("A3", [calendar.description, calendar.selectionNote].filter(Boolean).join("\n"), 9)}</row>`,
      `<row r="5" ht="32" customHeight="1">${[calendar.columns[0], t("share.week_calendar_from", document.lang), t("share.week_calendar_to", document.lang), calendar.columns[2]].map((title, index) => stringCell(columnName(index) + "5", title, 2)).join("")}</row>`,
      ...calendar.rows.map((row, index) => {
        const number = index + 6;
        const dateValue = value => Date.parse(value + "T00:00:00Z") / 86400000 + 25569;
        return `<row r="${number}" ht="26" customHeight="1">${numberCell("A" + number, row.number, 3 + index % 2)}${numberCell("B" + number, dateValue(row.from), 12 + index % 2)}${numberCell("C" + number, dateValue(row.to), 12 + index % 2)}${numberCell("D" + number, row.week, 10 + index % 2)}</row>`;
      }),
    ];
    const calendarLastRow = calendar.rows.length + 5;
    zip.file("xl/worksheets/sheet2.xml", `<worksheet xmlns="${MAIN_NS}"><dimension ref="A1:D${calendarLastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView></sheetViews><cols>${[7, 21, 21, 22].map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${calendarRows.join("")}</sheetData><autoFilter ref="A5:D${calendarLastRow}"/><mergeCells count="3"><mergeCell ref="A1:D1"/><mergeCell ref="A2:D2"/><mergeCell ref="A3:D3"/></mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`);
  }
  zip.file("xl/worksheets/_rels/sheet1.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}<Relationship Id="brandLogo" Type="${REL_NS}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
  const imageWidth = Math.round(brand.width * 96 / 72 * 9525);
  const imageHeight = Math.round(brand.height * 96 / 72 * 9525);
  const imageLeft = Math.round((widths[widths.length - 1] * 7 + 5 - brand.width * 96 / 72 - 8) * 9525);
  zip.file("xl/drawings/drawing1.xml", `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>${columns.length - 1}</xdr:col><xdr:colOff>${imageLeft}</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>57150</xdr:rowOff></xdr:from><xdr:ext cx="${imageWidth}" cy="${imageHeight}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="${brand.name}" descr="${brand.name}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="${REL_NS}" r:embed="brandImage"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`);
  zip.file("xl/drawings/_rels/drawing1.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="brandImage" Type="${REL_NS}/image" Target="../media/planit-wordmark.png"/></Relationships>`);
  zip.file("xl/media/planit-wordmark.png", brand.base64, { base64: true });
  return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
};
