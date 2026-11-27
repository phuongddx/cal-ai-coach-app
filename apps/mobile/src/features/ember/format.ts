import { dayKey } from '@coachcal/core';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Tuesday, 24 Nov" */
export function formatHeaderDate(now: Date): string {
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/** "08:05" in local time. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function mealSlot(iso: string): string {
  const hour = new Date(iso).getHours();
  if (hour < 11) return 'Breakfast';
  if (hour < 15) return 'Lunch';
  if (hour < 18) return 'Snack';
  return 'Dinner';
}

export type WeekCell = { key: string; letter: string; day: number; selected: boolean };

/** Monday-first week containing `now`, as the week strip cells. */
export function weekStrip(now: Date): WeekCell[] {
  const sinceMonday = (now.getDay() + 6) % 7;
  const today = dayKey(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday + i);
    return { key: dayKey(d), letter: WEEKDAYS[d.getDay()][0], day: d.getDate(), selected: dayKey(d) === today };
  });
}
