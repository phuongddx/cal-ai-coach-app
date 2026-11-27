/**
 * Copy helpers of the Today screen. Every string pins en_US so the output does not depend on the
 * device locale (the Swift view pins "of 2,150 kcal goal" the same way; the date formats of the Swift
 * `formatted(...)` calls follow the device locale, which is en for the reference snapshots).
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** `.dateTime.month(.abbreviated).day()` — "Nov 27". */
export function headerDateText(day: Date): string {
  return `${MONTHS[day.getMonth()].slice(0, 3)} ${day.getDate()}`;
}

/** `.dateTime.weekday(.narrow)` — the weekday initial. */
export function weekdayInitial(day: Date): string {
  return WEEKDAYS[day.getDay()].charAt(0);
}

/** `.dateTime.day()` — the day number. */
export function dayNumber(day: Date): string {
  return String(day.getDate());
}

/** `.dateTime.weekday(.wide).month(.wide).day()` — the day cell's VoiceOver label. */
export function dayCellLabel(day: Date): string {
  return `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}`;
}

/** `.formatted(date: .omitted, time: .shortened)` — "9:00 AM". */
export function shortTime(at: Date): string {
  const hours = at.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(at.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** `mealSlot.capitalized` — "Lunch". */
export function capitalized(slot: string): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

/** The recent-meals row meta: "Lunch · 12:40 PM". */
export function mealMeta(slot: string, loggedAt: Date): string {
  return `${capitalized(slot)} · ${shortTime(loggedAt)}`;
}

/** "of 2,150 kcal goal" — the hero subhead; "0" until the user has a goal (Swift goalSubheadText). */
export function goalSubheadText(goal: number | null): string {
  return goal === null ? '0' : goal.toLocaleString('en-US');
}
