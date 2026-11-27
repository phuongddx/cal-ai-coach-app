/**
 * TrackingRecords.swift / TrackingRepository.swift — water, weight and
 * exercise logs (local-only, no outbox). The model clamps guard the boundary:
 * exercise duration 0–600 minutes, burned kcal 0–5000 (parity DB-06), unsafe
 * numbers collapse to the floor instead of throwing.
 */
import { asc, desc, eq, sql } from 'drizzle-orm';

import { clamp } from '@coachcal/core';

import { exerciseLogs, waterLogs, weightLogs } from '../db/schema';
import { fromIso, toIso, type IdGenerator, type SqlDb } from './sqlDb';
import { newUuid } from '../sync/uuid';

export const EXERCISE_DURATION_MAX_MIN = 600;
export const EXERCISE_KCAL_MAX = 5000;

export interface WaterLog {
  id: string;
  userId: string;
  day: string;
  ml: number;
  createdAt: Date;
}

export interface WeightLog {
  id: string;
  userId: string;
  day: string;
  kg: number;
  createdAt: Date;
}

export interface ExerciseLog {
  id: string;
  userId: string;
  day: string;
  exerciseType: string;
  durationMin: number;
  kcalBurned: number | null;
  createdAt: Date;
}

function clampDuration(durationMin: number): number {
  return Math.round(clamp(durationMin, 0, EXERCISE_DURATION_MAX_MIN));
}

function clampBurnedKcal(kcalBurned: number | null): number | null {
  if (kcalBurned === null) return null;
  return Math.round(clamp(kcalBurned, 0, EXERCISE_KCAL_MAX));
}

export function waterLogToRow(log: WaterLog) {
  return { ...log, createdAt: toIso(log.createdAt) };
}

export function weightLogToRow(log: WeightLog) {
  return { ...log, createdAt: toIso(log.createdAt) };
}

export function exerciseLogToRow(log: ExerciseLog) {
  return {
    ...log,
    durationMin: clampDuration(log.durationMin),
    kcalBurned: clampBurnedKcal(log.kcalBurned),
    createdAt: toIso(log.createdAt),
  };
}

export function rowToWaterLog(row: typeof waterLogs.$inferSelect): WaterLog {
  return { id: row.id, userId: row.userId, day: row.day, ml: row.ml, createdAt: fromIso(row.createdAt) };
}

export function rowToWeightLog(row: typeof weightLogs.$inferSelect): WeightLog {
  return { id: row.id, userId: row.userId, day: row.day, kg: row.kg, createdAt: fromIso(row.createdAt) };
}

export function rowToExerciseLog(row: typeof exerciseLogs.$inferSelect): ExerciseLog {
  return {
    id: row.id,
    userId: row.userId,
    day: row.day,
    exerciseType: row.exerciseType,
    durationMin: row.durationMin,
    kcalBurned: row.kcalBurned,
    createdAt: fromIso(row.createdAt),
  };
}

export function createTrackingRepository(db: SqlDb, deps: { newId?: IdGenerator } = {}) {
  const newId: IdGenerator = deps.newId ?? newUuid;
  return {
    /** Total milliliters logged for the day (0 for a day with no rows). */
    async water(forDay: string): Promise<number> {
      const rows = await db
        .select({ total: sql<number>`COALESCE(SUM(${waterLogs.ml}), 0)` })
        .from(waterLogs)
        .where(eq(waterLogs.day, forDay));
      return Number(rows[0]?.total ?? 0);
    },

    async addWater(ml: number, day: string, userId: string, at: Date): Promise<void> {
      await db.insert(waterLogs).values(waterLogToRow({ id: newId(), userId, day, ml, createdAt: at }));
    },

    /** The `limit` most recent days, oldest first (Swift fetches desc then reverses). */
    async weights(limit: number): Promise<WeightLog[]> {
      const rows = await db
        .select()
        .from(weightLogs)
        .orderBy(desc(weightLogs.day), desc(weightLogs.createdAt))
        .limit(limit);
      return rows.map(rowToWeightLog).reverse();
    },

    async addWeight(log: WeightLog): Promise<void> {
      await db.insert(weightLogs).values(weightLogToRow(log));
    },

    async exercises(forDay: string): Promise<ExerciseLog[]> {
      const rows = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.day, forDay))
        .orderBy(asc(exerciseLogs.createdAt));
      return rows.map(rowToExerciseLog);
    },

    async addExercise(log: ExerciseLog): Promise<void> {
      await db.insert(exerciseLogs).values(exerciseLogToRow(log));
    },
  };
}

export type TrackingRepository = ReturnType<typeof createTrackingRepository>;
