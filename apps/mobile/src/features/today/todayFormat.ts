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

// --- U-76: the copy of the Ember frames (Today light, dark offline, ED-Safe) ---------------------

/** The frame's header subtitle: weekday, day, abbreviated month — "Tuesday, 24 Nov". */
export function headerSubtitleText(day: Date): string {
  return `${WEEKDAYS[day.getDay()]}, ${day.getDate()} ${MONTHS[day.getMonth()].slice(0, 3)}`;
}

/** "1,284" — thousands grouped in en_US, like `goalSubheadText`. */
export function groupedNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/** The macro grid value, "82 / 130 g" (both rounded). */
export function macroValueText(value: number, goal: number): string {
  return `${Math.round(value)} / ${Math.round(goal)} g`;
}

/** The chip of the header while the app is offline (frame Today (dark, offline)). */
export const OFFLINE_CHIP_TEXT = 'Offline · syncs later';

/**
 * The next meal of the day by the clock, on the hour edges of the app's meal slots (`mealSlotFor`:
 * breakfast before 11, lunch before 15, dinner before 21). After dinner the next meal is tomorrow's
 * breakfast. The model holds no plan of meals, so the clock is the only source.
 */
export function nextMealName(now: Date): 'Breakfast' | 'Lunch' | 'Dinner' {
  const hour = now.getHours();
  if (hour < 11) return 'Breakfast';
  if (hour < 15) return 'Lunch';
  if (hour < 21) return 'Dinner';
  return 'Breakfast';
}

/** The ED-Safe guidance of the ember card: a steady lead and the next meal. No number, no calorie word. */
export function edSafeGuidance(now: Date): { lead: string; next: string } {
  return { lead: 'Steady meals keep energy even.', next: `${nextMealName(now)} is next.` };
}

/** The meal row meta with the "syncs later" suffix while the row waits for the sync (frame 08). */
export function pendingMealMeta(meta: string, syncPending: boolean): string {
  return syncPending ? `${meta} · syncs later` : meta;
}

/** "12-day streak"; "No streak yet" before the first day. */
export function streakTitleText(days: number): string {
  return days > 0 ? `${days}-day streak` : 'No streak yet';
}

/** "1 freeze available" — the freeze line of the streak card. */
export function freezeLineText(freezesLeft: number): string {
  if (freezesLeft <= 0) return 'No freezes available';
  return freezesLeft === 1 ? '1 freeze available' : `${freezesLeft} freezes available`;
}
