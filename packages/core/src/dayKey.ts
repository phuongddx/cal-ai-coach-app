/**
 * DayKey.swift — the canonical local `YYYY-MM-DD` day key. Single convention
 * for every surface that groups or filters diary data: a day is the user's
 * LOCAL calendar day (the Today/week-strip convention), never the UTC day of
 * the stored timestamp.
 *
 * Swift takes an explicit `calendar` (the time-zone carrier); here the
 * default is the process time zone and an explicit IANA `timeZone` formats
 * the same instant in that zone. An invalid date returns an empty string
 * rather than throwing.
 */
export function dayKey(date: Date, timeZone?: string): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  if (timeZone !== undefined) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  }
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
