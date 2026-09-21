const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;

export const getCalendarDayNumber = (input) => {
  const date = new Date(input);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / CALENDAR_DAY_MS;
};

export const dateFromCalendarDayNumber = (number) => {
  const utc = new Date(Math.round(number) * CALENDAR_DAY_MS);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
};

export const normalizeCalendarDate = (dateInput) => {
  if (dateInput === null || dateInput === undefined) return null;

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return date;
};

export const getCalendarDayKey = (dateInput) => {
  const date = normalizeCalendarDate(dateInput);
  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addCalendarDays = (dateInput, offset) => {
  const date = normalizeCalendarDate(dateInput);
  if (!date) return null;

  date.setDate(date.getDate() + offset);
  return date;
};

export const getCalendarDayDistance = (fromInput, toInput) => {
  const from = normalizeCalendarDate(fromInput);
  const to = normalizeCalendarDate(toInput);
  if (!from || !to) return null;

  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / CALENDAR_DAY_MS);
};

const createPage = (timestamp, position) => ({
  timestamp,
  position,
  key: getCalendarDayKey(timestamp),
});

export const createDayWindow = (date, center = 0, revision = 0, previousPages = []) => {
  const timestamp = normalizeCalendarDate(date).getTime();
  // Keep day swipes and their adjacent weeks mounted before a gesture starts.
  const offsets = [-2, -1, 0, 1, 2, -9, -8, -7, -6, -5, 5, 6, 7, 8, 9];
  const pages = offsets.map((offset) => {
    const pageTimestamp = addCalendarDays(timestamp, offset).getTime();
    const position = center + offset;
    return previousPages.find((page) => (
      page.timestamp === pageTimestamp && page.position === position
    )) ?? createPage(pageTimestamp, position);
  });
  const required = new Set(pages.map((page) => page.timestamp));
  for (const page of previousPages) {
    if (pages.length >= 45) break;
    if (required.has(page.timestamp)) continue;
    const position = center + getCalendarDayDistance(timestamp, page.timestamp);
    pages.push(page.position === position ? page : { ...page, position });
    required.add(page.timestamp);
  }
  return { timestamp, center, revision, pages, target: null, animated: false };
};

export const prepareDayWindow = (current, date, animated, revision) => {
  const timestamp = normalizeCalendarDate(date).getTime();
  if (timestamp === current.timestamp) {
    return { ...current, revision, target: null };
  }
  const target = current.pages.find((page) => page.timestamp === timestamp && Math.abs(page.position - current.center) <= 2)?.position
    ?? current.center + Math.sign(timestamp - current.timestamp);
  const destination = createDayWindow(timestamp, target, revision, current.pages);
  const outgoing = current.pages.find((page) => page.position === current.center);
  const pages = destination.pages
    .filter((page) => page.timestamp !== outgoing.timestamp || page.position === current.center)
    .map((page) => page.position === current.center ? outgoing : page);
  return { ...current, revision, pages, target, animated };
};

export const settleDayWindow = (current, position, revision) => {
  const page = current.pages.find((candidate) => candidate.position === position);
  return createDayWindow(page.timestamp, position, revision, current.pages);
};
