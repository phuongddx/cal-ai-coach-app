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
import { SyncProbeScreen } from './SyncProbeScreen';

/**
 * Development-only auth-stub session boundary (Plan 01-05 Task 1).
 * Credentials are entered at runtime for the non-production proof users; no
 * test password is stored in source or Expo public config. Binds the local
 * ownerId, starts the Plan 04 lifecycle for that owner, and stops it on any
 * transition — in that order, atomically per sign-in.
 */

function makeFoundationDeps(): FoundationDeps {
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
      // Phase 1 status: connectivity-driven. Dispatcher failures surface
      // through lifecycle retry; detailed queue UI is Phase 3 scope.
      return 'idle';
    },
    startLifecycle(ownerId: string) {
      if (lifecycleByOwner.has(ownerId)) return;
      lifecycleByOwner.set(
        ownerId,
        startSyncLifecycle(ownerId, {
          dispatch: async (boundOwner) => {
            await runDispatch(db, boundOwner, {
              transport: createSupabaseTransport(supabase),
            });
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

export function FoundationSession() {
  const controller: FoundationController = useMemo(
    () => createFoundationController(makeFoundationDeps()),
    []
  );
  const [state, setState] = useState(controller.getState());
  useEffect(
    () => controller.subscribe(() => setState(controller.getState())),
    [controller]
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
