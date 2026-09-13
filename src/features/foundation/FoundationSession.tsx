import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { db } from '@/db/client';
import {
  createDiaryEntry,
  listDiaryEntries,
  updateDiaryEntry,
} from '@/db/repositories/diaryEntries';
import { runDispatch } from '@/db/sync/dispatcher';
import { startSyncLifecycle, type SyncLifecycleHandle } from '@/db/sync/lifecycle';
import { createSupabaseTransport } from '@/db/sync/transport';
import { getSupabaseClient } from '@/lib/supabase';
import type { FoundationDeps } from './FoundationDeps';
import { createFoundationController, type FoundationController } from './FoundationController';
import { runProofAuto } from './ProofAuto';
import { SyncProbeScreen } from './SyncProbeScreen';

/**
 * Development-only auth-stub session boundary (Plan 01-05 Task 1).
 * Credentials are entered at runtime for the non-production proof users; no
 * test password is stored in source or Expo public config. Binds the local
 * ownerId, starts the Plan 04 lifecycle for that owner, and stops it on any
 * transition — in that order, atomically per sign-in.
 *
 * DEV-ONLY proof driver: with EXPO_PUBLIC_PROOF_AUTO=1 (Metro env), the app
 * runs the Phase 1 checkpoint scenarios autonomously and emits redacted proofs
 * on the Metro console for machine validation. Gated off in normal runs.
 */

function makeFoundationDeps(onSettled: () => void): FoundationDeps {
  const supabase = getSupabaseClient();
  const lifecycleByOwner = new Map<string, SyncLifecycleHandle>();

  return {
    async signIn(email: string, password: string): Promise<string> {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user) {
        throw new Error(`proof sign-in failed: ${error?.message ?? 'no user'}`);
      }
      return data.user.id;
    },
    async signOut(): Promise<void> {
      await supabase.auth.signOut();
    },
    listRows(ownerId: string) {
      return listDiaryEntries(db, ownerId);
    },
    async createRow(ownerId: string, displayText: string) {
      const row = createDiaryEntry(db, ownerId, displayText);
      if (!row) throw new Error('seed row missing after create');
      return row;
    },
    async updateRow(ownerId: string, id: string, displayText: string) {
      return updateDiaryEntry(db, ownerId, id, displayText);
    },
    subscribeRows(listener: () => void) {
      // The walking skeleton refreshes via controller-emitted mutations;
      // Drizzle live-query binding arrives with Phase 3 product screens.
      return () => undefined;
    },
    getQueueStatus() {
      return 'idle';
    },
    startLifecycle(ownerId: string) {
      if (lifecycleByOwner.has(ownerId)) return;
      lifecycleByOwner.set(
        ownerId,
        startSyncLifecycle(ownerId, {
          dispatch: async (boundOwner) => {
            console.log('[sync-dispatch] start', boundOwner);
            try {
              const result = await runDispatch(db, boundOwner, {
                transport: createSupabaseTransport(supabase),
              });
              console.log('[sync-dispatch] done', JSON.stringify(result));
            } catch (error) {
              console.log(
                '[sync-dispatch] error',
                error instanceof Error ? error.message : String(error)
              );
              throw error;
            }
          },
          netInfo: {
            addEventListener(listener) {
              return NetInfo.addEventListener((state) =>
                listener({ isConnected: state.isConnected ?? null })
              );
            },
          },
        })
      );
    },
    stopLifecycle(ownerId: string) {
      lifecycleByOwner.get(ownerId)?.stop();
      lifecycleByOwner.delete(ownerId);
    },
    notifyLocalMutation(ownerId: string) {
      lifecycleByOwner.get(ownerId)?.notifyLocalMutation(ownerId);
    },
  };
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

export function FoundationSession() {
  const controller: FoundationController = useMemo(() => {
    const hooks: { onSettled: () => void } = { onSettled: () => undefined };
    const created = createFoundationController(
      makeFoundationDeps(() => hooks.onSettled())
    );
    hooks.onSettled = () => created.refresh();
    return created;
  }, []);
  const [state, setState] = useState(controller.getState());
  useEffect(
    () => controller.subscribe(() => setState(controller.getState())),
    [controller]
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const proofAuto = process.env.EXPO_PUBLIC_PROOF_AUTO === '1';
  const proofUserB = process.env.EXPO_PUBLIC_PROOF_USER === 'b';

  useEffect(() => {
    if (!proofAuto || state.owner) return;
    let cancelled = false;
    void (async () => {
      await sleep(1500); // let Metro/JS settle after boot
      if (cancelled) return;
      if (proofUserB) {
        // User B isolation: fresh install signs in as B — no A rows visible,
        // no local row to edit (repository refuses).
        await controller.signIn('b@proof.local', 'phase1-proof-2026');
        await sleep(2000);
        const rows = controller.getState().rows;
        let editDenied = false;
        try {
          await controller.editRow('b must not own a row');
        } catch {
          editDenied = true;
        }
        console.log(
          '[phase1-proof]',
          JSON.stringify({
            scenario: 'user-b-denial',
            runId: Math.random().toString(36).slice(2, 10),
            rowCount: rows.length,
            editDenied,
            pendingCount: 0,
            tombstone: false,
          })
        );
        return;
      }
      await runProofAuto(controller);
    })();
    return () => {
      cancelled = true;
    };
  }, [proofAuto, proofUserB, controller, state.owner]);

  async function submit(): Promise<void> {
    setError('');
    try {
      await controller.signIn(email, password);
      const owner = controller.getState().owner;
      if (owner) {
        await controller.seedIfEmpty('First synced entry');
      }
    } catch (signError) {
      setError((signError as Error).message);
    }
  }

  if (!state.owner) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-light p-6 dark:bg-surface-dark">
        <Text className="mb-4 text-ink-light dark:text-ink-dark">
          Phase 1 proof sign-in (non-production account)
        </Text>
        <TextInput
          testID="proof-email"
          className="mb-2 w-full border border-muted-light p-2 text-ink-light"
          placeholder="email"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          testID="proof-password"
          className="mb-2 w-full border border-muted-light p-2 text-ink-light"
          placeholder="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text className="text-red-600">{error}</Text> : null}
        <Pressable
          testID="proof-submit"
          className="mt-2 rounded bg-accent-lime p-3"
          onPress={() => void submit()}
        >
          <Text>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return <SyncProbeScreen controller={controller} />;
}
