/**
 * UserTarget.swift / TargetRepository.swift — the local-only nutrition
 * targets. Every save still goes through TargetsEngine upstream; this layer
 * only stores.
 */
import { desc, eq } from 'drizzle-orm';

import { userTargets } from '../db/schema';
import { fromIso, toIso, type SqlDb } from './sqlDb';

export interface UserTarget {
  id: string;
  userId: string;
  dailyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberGoalG: number;
  waterGlasses: number;
  sex: string;
  heightCm: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
  paceKgPerWeek: number | null;
  activity: string;
  goal: string;
  updatedAt: Date;
}

export function targetToRow(target: UserTarget) {
  return { ...target, updatedAt: toIso(target.updatedAt) };
}

export function rowToTarget(row: typeof userTargets.$inferSelect): UserTarget {
  return {
    id: row.id,
    userId: row.userId,
    dailyKcal: row.dailyKcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberGoalG: row.fiberGoalG,
    waterGlasses: row.waterGlasses,
    sex: row.sex,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    goalWeightKg: row.goalWeightKg,
    paceKgPerWeek: row.paceKgPerWeek,
    activity: row.activity,
    goal: row.goal,
    updatedAt: fromIso(row.updatedAt),
  };
}

export function createTargetRepository(db: SqlDb) {
  return {
    /** The most recently saved target for the user (Swift orders by updated_at desc). */
    async activeTarget(user: string): Promise<UserTarget | null> {
      const rows = await db
        .select()
        .from(userTargets)
        .where(eq(userTargets.userId, user))
        .orderBy(desc(userTargets.updatedAt))
        .limit(1);
      return rows[0] === undefined ? null : rowToTarget(rows[0]);
    },

    async saveTarget(target: UserTarget): Promise<void> {
      const row = targetToRow(target);
      await db.insert(userTargets).values(row).onConflictDoUpdate({ target: userTargets.id, set: row });
    },
  };
}

export type TargetRepository = ReturnType<typeof createTargetRepository>;
