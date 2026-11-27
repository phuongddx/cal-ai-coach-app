/**
 * The iOS Increase Contrast setting as a shared store for `useTokens()`.
 *
 * React Native 0.88 names it "darker system colors": `AccessibilityInfo.isDarkerSystemColorsEnabled()`
 * (a promise) and the event `darkerSystemColorsChanged` (iOS only, payload `boolean`). The brief of U-71c
 * wrote `isHighContrastEnabled` / `highContrastChanged`; neither exists in the typings of
 * `react-native@0.88.1` (findings/U-71c.md), this is the same setting under its real name.
 *
 * One native listener serves every component: it is added when the first `useTokens()` mounts and removed
 * when the last one unmounts, and the value is forgotten then, so the next mount asks again.
 */

import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

type Subscription = { remove: () => void };

const listeners = new Set<() => void>();
let enabled = false;
let subscription: Subscription | null = null;
/** Bumped on every start and stop so a late promise of an earlier subscription is dropped. */
let generation = 0;

function set(value: boolean): void {
  if (value === enabled) return;
  enabled = value;
  for (const listener of listeners) listener();
}

function start(): void {
  if (Platform.OS !== 'ios') return;
  const mine = ++generation;
  let eventSeen = false;
  subscription = AccessibilityInfo.addEventListener('darkerSystemColorsChanged', (value) => {
    eventSeen = true;
    set(value);
  });
  AccessibilityInfo.isDarkerSystemColorsEnabled()
    .then((value) => {
      // An event that arrived first is newer than the answer to the first question.
      if (mine === generation && !eventSeen) set(value);
    })
    .catch(() => {
      // A native build without `getCurrentDarkerSystemColorsState` rejects: treat as the normal contrast.
    });
}

function stop(): void {
  generation += 1;
  subscription?.remove();
  subscription = null;
  enabled = false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = (): boolean => enabled;

/** True while Settings > Accessibility > Display & Text Size > Increase Contrast is on (iOS). */
export function useHighContrast(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
