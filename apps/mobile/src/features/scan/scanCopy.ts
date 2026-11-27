/** Display strings shared by the scan screens (ManualLogSheet.mealName and the abbreviated reset date). */
import type { MealSlot } from './scanTypes';

export function mealName(slot: MealSlot): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

/** `Date.formatted(date: .abbreviated, time: .omitted)` in the en_US locale: "Nov 27, 2026". */
export function abbreviatedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
