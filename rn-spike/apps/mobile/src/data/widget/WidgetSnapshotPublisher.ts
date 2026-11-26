import { AppState, type AppStateStatus } from 'react-native';
import type { WidgetTimelineEntry } from 'expo-widgets';

import caloriesWidget, { type CaloriesWidgetProps } from '../../widgets/CaloriesWidget';

export type WidgetSnapshot = CaloriesWidgetProps;
export type WidgetTimeline = WidgetTimelineEntry<WidgetSnapshot>[];

/** The widget part of the publisher, so tests can swap the native-backed widget for a fake. */
export type WidgetHandle = {
  updateTimeline: (entries: WidgetTimeline) => void;
  reload: () => void;
};

export type PublisherLogger = (event: string, data?: Record<string, unknown>) => void;

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Local calendar day as `YYYY-MM-DD` (the app's day key; computed here so T2 does not depend on T1). */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** The next local midnight strictly after `now` (DST-safe: `Date` normalizes day + 1). */
export function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

/**
 * Timeline for one snapshot: the snapshot itself from `now`, then a zeroed snapshot (same goals,
 * new day key) at the next local midnight so the widget rolls over to the new day without the
 * app running. A placeholder snapshot (`date === ''`) has no day to roll over, so it stays one entry.
 */
export function buildTimeline(snapshot: WidgetSnapshot, now: Date): WidgetTimeline {
  const current: WidgetTimelineEntry<WidgetSnapshot> = { date: now, props: { ...snapshot } };
  if (snapshot.date === '') {
    return [current];
  }
  const midnight = nextLocalMidnight(now);
  return [
    current,
    {
      date: midnight,
      props: {
        ...snapshot,
        date: localDayKey(midnight),
        consumedKcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
    },
  ];
}

const defaultHandle: WidgetHandle = {
  updateTimeline: (entries) => caloriesWidget.updateTimeline(entries),
  reload: () => caloriesWidget.reload(),
};

const defaultLog: PublisherLogger = (event, data) => {
  console.log(`[spike] ${event}`, data ?? '');
};

type PublishDeps = { widget?: WidgetHandle; now?: () => Date; log?: PublisherLogger };

/**
 * Pushes a snapshot to the widget. On iOS `updateSnapshot` is `updateTimeline([{ date: now, props }])`
 * and `updateTimeline` already reloads the widget natively, so one `updateTimeline` call with the
 * two entries is enough.
 *
 * Best effort: a failure is logged and never thrown, so the app does not depend on the widget.
 * Returns `true` when the timeline was handed to the widget.
 */
export function publish(snapshot: WidgetSnapshot, deps: PublishDeps = {}): boolean {
  const { widget = defaultHandle, now = () => new Date(), log = defaultLog } = deps;
  try {
    const entries = buildTimeline(snapshot, now());
    widget.updateTimeline(entries);
    log('widget-publish', {
      date: snapshot.date,
      entries: entries.length,
      nextEntryAt: entries[1]?.date.toISOString() ?? null,
    });
    return true;
  } catch (error) {
    log('widget-publish-failed', { message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/** Asks WidgetKit to re-read the stored timeline. Best effort, like `publish`. */
export function reload(deps: Pick<PublishDeps, 'widget' | 'log'> = {}): boolean {
  const { widget = defaultHandle, log = defaultLog } = deps;
  try {
    widget.reload();
    return true;
  } catch (error) {
    log('widget-reload-failed', { message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export type AppStateLike = {
  addEventListener: (
    type: 'change',
    listener: (state: AppStateStatus) => void
  ) => { remove: () => void };
};

/**
 * Starts reloading the widget every time the app comes to the foreground. Returns the subscription;
 * call `remove()` to stop. The app starts it once at launch.
 */
export function startForegroundReload(
  deps: Pick<PublishDeps, 'widget' | 'log'> & { appState?: AppStateLike } = {}
): { remove: () => void } {
  const { appState = AppState, ...rest } = deps;
  return appState.addEventListener('change', (state) => {
    if (state === 'active') {
      reload(rest);
    }
  });
}
