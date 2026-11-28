/**
 * The pure helpers of the Progress flow (ProgressFlow.swift statics +
 * WeightLogSheet.kgValues + WeeklyEnergyColumn.dayInitial): the weight clamp
 * domain, the local-day conversions and the weekday symbols. Pure functions
 * only, zero imports beyond the core day key.
 */
import { dayKey } from '@coachcal/core';

/** ProgressModel.kgRange — the wheel offers 40–250 in 0.1 steps. */
export const KG_RANGE = { min: 40, max: 250 } as const;

/**
 * The range segment's windows (frame 11: Week / Month / 3M / Year, Month
 * selected). The values are the testIDs after `progress.range.`.
 */
export type ProgressRange = 'week' | 'month' | '3m' | 'year';

/** The trailing window in local days each range reads. */
export const RANGE_WINDOW_DAYS: Record<ProgressRange, number> = {
  week: 7,
  month: 30,
  '3m': 90,
  year: 365,
};

/**
 * ProgressModel.clampKg — untrusted numeric input clamps (and snaps to one
 * decimal) at the model boundary (T-P06-02).
 */
export function clampKg(kg: number): number {
  const clamped = Math.min(Math.max(kg, KG_RANGE.min), KG_RANGE.max);
  return Math.round(clamped * 10) / 10;
}

/**
 * WeightLogSheet.kgValues — the wheel domain, pre-snapped to one decimal so
 * Picker selection equality holds (indexOf works on identical floats).
 */
export const KG_VALUES: number[] = Array.from(
  { length: Math.round((KG_RANGE.max - KG_RANGE.min) * 10) + 1 },
  (_, index) => (KG_RANGE.min * 10 + index) / 10,
);

/** ProgressModel.dayString — the canonical local day key (DayKey). */
export function dayString(date: Date): string {
  return dayKey(date);
}

/** Calendar-day add on the local timeline (DST-safe: `Date` normalizes). */
export function addDays(date: Date, days: number): Date {
  const moved = new Date(date);
  moved.setDate(moved.getDate() + days);
  return moved;
}

/** ProgressModel.date(fromDay:) — a day key parses to local midnight. */
export function dateFromDay(day: string): Date | null {
  const parts = day.split('-');
  if (parts.length !== 3) {
    return null;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const dayNumber = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(dayNumber)) {
    return null;
  }
  return new Date(year, month - 1, dayNumber);
}

/** Calendar.veryShortWeekdaySymbols — the single-letter weekday initials, Sunday first. */
export const VERY_SHORT_WEEKDAY_SYMBOLS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** WeeklyEnergyColumn.dayInitial — the single-letter caption of a day bar. */
export function dayInitial(day: string): string {
  const date = dateFromDay(day);
  if (date === null) {
    return '?';
  }
  return VERY_SHORT_WEEKDAY_SYMBOLS[date.getDay()] ?? '?';
}
