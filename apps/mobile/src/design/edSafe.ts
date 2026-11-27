/**
 * The single ED-Safe Mode API (TRU-04) — the port of
 * `native/Modules/CoachCalDesignSystem/Sources/CoachCalDesignSystem/EdSafe.swift`.
 *
 * Invariant I7: components own the policy branch, feature code has none. Feature
 * code opts a surface in or out exclusively through these functions; it never reads
 * the flag another way and never reimplements the branch.
 *
 * Module state with subscribers (the `zustand` package joins in U-13 and is not in
 * this worktree). Not persisted: U-51 persists it.
 */

import { useSyncExternalStore } from 'react';

let mode = false;
const subscribers = new Set<() => void>();

/** Whether ED-Safe Mode is on. */
export function edSafeMode(): boolean {
  return mode;
}

/** True when the mode is on: a calorie-framing surface must collapse. */
export function edSafeHidden(): boolean {
  return mode;
}

/** Feature code turns a surface's ED-safe branch on or off through this only. */
export function setEdSafeMode(value: boolean): void {
  if (mode === value) return;
  mode = value;
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}

// Stable snapshot: the boolean primitive never changes identity, so
// `useSyncExternalStore` cannot loop and the React Compiler cannot cache a stale
// store read (spike build-recipe pitfall 13).
function getSnapshot(): boolean {
  return mode;
}

/** The ED-safe flag for components; re-renders when the mode flips. */
export function useEdSafeMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** The collapse flag for components; same value as `edSafeHidden()`. */
export function useEdSafeHidden(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
