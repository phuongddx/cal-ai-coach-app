/** Display strings shared by the scan screens (ManualLogSheet.mealName, with the fourth slot named "Snack" as the Ember frames do, and the abbreviated reset date). */
import type { MealSlot } from './scanTypes';

export function mealName(slot: MealSlot): string {
  return slot === 'snacks' ? 'Snack' : slot.charAt(0).toUpperCase() + slot.slice(1);
}

/** The meal segment of Review and Describe: the Ember frames name the fourth slot "Snack". */
export const MEAL_SEGMENT_OPTIONS: ReadonlyArray<{ value: MealSlot; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snack' },
];

/** The weekday the quota window resets on, in the user's time zone: "Monday". Empty when the date is unreadable. */
export function resetWeekday(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/** `Date.formatted(date: .abbreviated, time: .omitted)` in the en_US locale: "Nov 27, 2026". */
export function abbreviatedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
