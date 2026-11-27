/**
 * DiaryMath (ManualLogSheet.swift) plus the small shared helpers of the diary
 * feature: the slot order, the display name and emoji of a slot, and the
 * WR-08 deep-link day parse. Pure functions only.
 */
import { dayKey, roundKcal } from '@coachcal/core';

/** DiaryDayModel.slotOrder — the fixed section order of the day sheet. */
export const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

export type MealSlotName = (typeof SLOT_ORDER)[number];

/**
 * ManualLogSheet.DiaryMath.manualKcal — the manual-entry kcal is always
 * derived from the food row (round(per100g × grams / 100), half-up), never a
 * user-typed or stored display value (T-P04-01).
 */
export function manualKcal(per100gKcal: number, grams: number): number {
  return roundKcal(per100gKcal, grams);
}

/** ManualLogSheet.DiaryMath.servingKcal — per-serving kcal scales by servings. */
export function servingKcal(perServingKcal: number, servings: number): number {
  return perServingKcal * servings;
}

/** ManualLogSheet.mealName / DiaryDayView.mealName — "breakfast" → "Breakfast". */
export function mealName(slot: string): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

/** DiaryDayView.slotEmoji — the section header emoji. */
export function slotEmoji(slot: string): string {
  switch (slot) {
    case 'breakfast':
      return '☀️';
    case 'lunch':
      return '🌤️';
    case 'dinner':
      return '🌙';
    default:
      return '🍎';
  }
}

/** DiaryDayModel.dayString — the canonical local day key (DayKey). */
export function dayString(date: Date): string {
  return dayKey(date);
}

/**
 * WR-08: `coachcal://diary?date=` — a `YYYY-MM-DD` day parses to LOCAL NOON of
 * that day (the old UTC-midnight parse opened yesterday's local day west of
 * UTC); absent or malformed values return null and the route falls back to
 * today.
 */
export function linkDate(param: string | string[] | undefined): Date | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (raw === undefined) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  // Calendar.date(from:) rejects impossible combinations; reject rollovers
  // (2026-02-31 → March 3) the same way.
  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }
  return parsed;
}
