import { spikeLog } from './spikeLog';
import type { SpikeAction, SpikeActionName, SpikeActionResult } from './types';

const actions = new Map<SpikeActionName, SpikeAction>();
const listeners = new Set<() => void>();

export type SpikeRunRecord = {
  name: SpikeActionName;
  running: boolean;
  result?: SpikeActionResult;
  at: string;
};

let actionList: SpikeAction[] = [];
let lastRuns: Partial<Record<SpikeAction['item'], SpikeRunRecord>> = {};

function notify() {
  listeners.forEach((l) => l());
}

export function registerSpikeAction(action: SpikeAction): void {
  actions.set(action.name, action);
  actionList = [...actions.values()];
  notify();
}

export function getSpikeAction(name: string): SpikeAction | undefined {
  return actions.get(name as SpikeActionName);
}

export function listSpikeActions(): SpikeAction[] {
  return actionList; // stable snapshot for useSyncExternalStore
}

export function getLastRuns() {
  return lastRuns;
}

export function subscribeSpike(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Run a registered action, log it, and publish its result for the console. Never throws. */
export async function runSpikeAction(name: string, params: Readonly<Record<string, string>> = {}): Promise<SpikeActionResult> {
  const action = getSpikeAction(name);
  if (!action) {
    const result: SpikeActionResult = { status: 'error', summary: `unknown action: ${name}` };
    spikeLog('ui', 'action-unknown', { name });
    return result;
  }
  const at = new Date().toISOString();
  lastRuns = { ...lastRuns, [action.item]: { name: action.name, running: true, at } };
  notify();
  spikeLog(action.item, 'action-start', { name: action.name });
  let result: SpikeActionResult;
  try {
    result = await action.run({ log: (event, data) => spikeLog(action.item, event, data), params });
  } catch (e) {
    result = { status: 'error', summary: e instanceof Error ? e.message : String(e) };
  }
  lastRuns = { ...lastRuns, [action.item]: { name: action.name, running: false, result, at } };
  spikeLog(action.item, 'action-done', { name: action.name, status: result.status, summary: result.summary });
  notify();
  return result;
}

/** Test helper: forget every registered action and run record. */
export function resetSpikeRegistry() {
  actions.clear();
  actionList = [];
  lastRuns = {};
  notify();
}
