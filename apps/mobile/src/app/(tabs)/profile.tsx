/**
 * The profile route (ProfileFlow.swift): the stats snapshot over the data
 * environment, the settings push and the target-edit sheet presentation. This
 * is the only file of the feature that touches the data seams — it builds the
 * models' dependencies and hands them over (standing-order rule 19). The
 * route's tests live beside the screens in the feature, never under src/app.
 */
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { sql } from 'drizzle-orm';

import { dayKey } from '@coachcal/core';

import { getSessionStore } from '../../data/auth';
import { getDataEnvironment } from '../../data/environment';
import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import { notifyLocalMutation } from '../../data/sync/runtime';

import { ProfileView } from '../../features/profile/ProfileView';
import { createProfileModel, type ProfileStats } from '../../features/profile/profileModel';
import { createTargetEditModel } from '../../features/profile/targetEditModel';
import { TargetEditSheet } from '../../features/profile/TargetEditSheet';

/**
 * The stats query bundle (ProfileModel's ValueObservation tracking closure):
 * the latest target, the member-since date (MIN updated_at), the latest weight
 * and the 30-day logged-days count.
 */
async function loadStats(ownerId: string, monthStart: string): Promise<ProfileStats> {
  const env = await getDataEnvironment();
  const target = await env.targets.activeTarget(ownerId);
  const memberSinceRows = await env.db.all<{ since: string | null }>(
    sql`SELECT MIN(updated_at) AS since FROM user_targets WHERE user_id = ${ownerId}`,
  );
  const weightRows = await env.db.all<{ kg: number }>(
    sql`SELECT kg FROM weight_logs WHERE user_id = ${ownerId} ORDER BY day DESC, created_at DESC LIMIT 1`,
  );
  const loggedRows = await env.db.all<{ n: number }>(
    sql`SELECT COUNT(DISTINCT date(created_at, 'localtime')) AS n FROM diary_entries
        WHERE deleted_at IS NULL AND user_id = ${ownerId} AND date(created_at, 'localtime') >= ${monthStart}`,
  );
  const since = memberSinceRows[0]?.since ?? null;
  return {
    target,
    latestKg: weightRows[0]?.kg ?? null,
    daysLogged: Number(loggedRows[0]?.n ?? 0),
    memberSince: since === null ? null : new Date(since),
  };
}

export default function ProfileRoute() {
  const router = useRouter();
  const ownerId = getSessionStore().getSession()?.user.id ?? DEMO_USER_ID;
  const model = useMemo(() => {
    const now = () => new Date();
    const monthStart = dayKey(new Date(now().getTime() - 29 * 24 * 60 * 60 * 1000));
    return createProfileModel({
      ownerId,
      now,
      loadStats: () => loadStats(ownerId, monthStart),
    });
  }, [ownerId]);
  useEffect(() => {
    void model.refresh();
  }, [model]);

  const [editingTargets, setEditingTargets] = useState(false);
  const target = model.stats.target;
  const editModel = useMemo(
    () =>
      target === null
        ? null
        : createTargetEditModel({
            initial: target,
            now: () => new Date(),
            saveTarget: async (saved) => {
              (await getDataEnvironment()).targets.saveTarget(saved);
              notifyLocalMutation();
            },
          }),
    [target],
  );

  return (
    <View style={{ flex: 1 }}>
      <ProfileView
        stats={model.stats}
        // Display-only entitlement state: Phase 3 is Free-only and no RN module
        // keeps a stored entitlement yet (see findings/U-41.md).
        planName="Free"
        onEditTargets={target === null ? null : () => setEditingTargets(true)}
        onOpenSettings={() => router.push('/settings')}
      />
      {editingTargets && editModel !== null && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          <TargetEditSheet model={editModel} onDismiss={() => setEditingTargets(false)} />
        </View>
      )}
    </View>
  );
}
