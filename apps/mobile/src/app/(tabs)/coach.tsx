/**
 * The Coach route (CH-01). This is the only file of the coach feature that
 * touches the data seams — it builds the model's dependency bundle and hands
 * it to the feature factory together with the greeting (standing-order rule
 * 19). The route's tests live beside the screens in the feature, never under
 * src/app.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getSessionStore } from '../../data/auth';
import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import { getDataEnvironment } from '../../data/environment';
import { getSyncRuntime, notifyLocalMutation } from '../../data/sync/runtime';
import type { SyncRuntime } from '../../data/sync/runtime';

import { createCoachModel, greeting } from '../../features/coach/coachModel';
import type { CoachDeps } from '../../features/coach/coachModel';
import { CoachView } from '../../features/coach/screens/CoachView';

/**
 * The sync runtime's subscribe, callable before the runtime resolves: early
 * listeners wait for the runtime, then ride its re-read signal.
 */
function makeRuntimeSubscribe(): CoachDeps['subscribe'] {
  let runtime: SyncRuntime | null = null;
  const waiting: Array<{ listener: () => void; unsubscribe: (() => void) | null }> = [];
  void getSyncRuntime().then((resolved) => {
    runtime = resolved;
    for (const entry of waiting.splice(0)) {
      entry.unsubscribe = resolved.subscribe(entry.listener);
    }
  });
  return (listener: () => void) => {
    if (runtime !== null) {
      return runtime.subscribe(listener);
    }
    const entry: { listener: () => void; unsubscribe: (() => void) | null } = { listener, unsubscribe: null };
    waiting.push(entry);
    return () => {
      entry.unsubscribe?.();
      const index = waiting.indexOf(entry);
      if (index >= 0) {
        waiting.splice(index, 1);
      }
    };
  };
}

export default function CoachScreen() {
  const [session, setSession] = useState<{
    model: ReturnType<typeof createCoachModel>;
    greeting: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const environment = await getDataEnvironment();
      const deps: CoachDeps = {
        db: environment.db,
        targets: environment.targets,
        engagement: environment.engagement,
        ownerId: getSessionStore().getSession()?.user.id ?? DEMO_USER_ID,
        subscribe: makeRuntimeSubscribe(),
        now: environment.now,
      };
      const model = createCoachModel(deps);
      await model.refresh();
      if (mounted) {
        setSession({ model, greeting: greeting(environment.now()) });
      }
    })();
    return () => {
      mounted = false;
    };
    // The observation runs once per mount; the re-read signal drives the rest.
  }, []);

  if (session === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <CoachView model={session.model} greeting={session.greeting} />;
}
