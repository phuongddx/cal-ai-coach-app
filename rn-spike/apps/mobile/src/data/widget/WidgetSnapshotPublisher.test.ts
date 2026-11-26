// The widget module calls createWidget, which needs the expo-widgets native module.
jest.mock('../../widgets/CaloriesWidget', () => ({
  __esModule: true,
  default: { updateTimeline: jest.fn(), reload: jest.fn() },
}));

import {
  buildTimeline,
  localDayKey,
  nextLocalMidnight,
  publish,
  reload,
  startForegroundReload,
  type AppStateLike,
  type WidgetSnapshot,
} from './WidgetSnapshotPublisher';
import { fixtureSnapshot, widgetSpikeAction } from './spikeActions';

const snapshot: WidgetSnapshot = {
  date: '2026-11-27',
  consumedKcal: 1284,
  goalKcal: 2100,
  proteinG: 82,
  carbsG: 140,
  fatG: 38,
  proteinGoalG: 130,
  carbsGoalG: 210,
  fatGoalG: 70,
};

describe('buildTimeline', () => {
  const now = new Date(2026, 10, 27, 14, 30, 5); // local 2026-11-27 14:30:05

  it('returns the snapshot at now, then a zeroed snapshot at the next local midnight', () => {
    const entries = buildTimeline(snapshot, now);
    expect(entries).toHaveLength(2);
    expect(entries[0].date).toEqual(now);
    expect(entries[0].props).toEqual(snapshot);
    expect(entries[1].date).toEqual(new Date(2026, 10, 28, 0, 0, 0, 0));
  });

  it('zeroes consumption and macros at midnight but keeps the goals and moves the day key', () => {
    const [, midnight] = buildTimeline(snapshot, now);
    expect(midnight.props).toEqual({
      date: '2026-11-28',
      consumedKcal: 0,
      goalKcal: 2100,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      proteinGoalG: 130,
      carbsGoalG: 210,
      fatGoalG: 70,
    });
  });

  it('does not mutate the snapshot it is given', () => {
    const copy = { ...snapshot };
    buildTimeline(snapshot, now);
    expect(snapshot).toEqual(copy);
  });

  it('rolls over a month end', () => {
    const [, midnight] = buildTimeline({ ...snapshot, date: '2026-11-30' }, new Date(2026, 10, 30, 9, 0));
    expect(midnight.props.date).toBe('2026-12-01');
  });

  it('rolls over a year end', () => {
    const [, midnight] = buildTimeline({ ...snapshot, date: '2026-12-31' }, new Date(2026, 11, 31, 23, 59));
    expect(midnight.props.date).toBe('2027-01-01');
    expect(midnight.date).toEqual(new Date(2027, 0, 1, 0, 0, 0, 0));
  });

  it('rolls over a leap day', () => {
    const [, midnight] = buildTimeline({ ...snapshot, date: '2028-02-28' }, new Date(2028, 1, 28, 12, 0));
    expect(midnight.props.date).toBe('2028-02-29');
  });

  it('puts the midnight entry one second away when now is 23:59:59', () => {
    const late = new Date(2026, 10, 27, 23, 59, 59);
    const entries = buildTimeline(snapshot, late);
    expect(entries[1].date.getTime() - late.getTime()).toBe(1000);
  });

  it('puts the next midnight a full day away when now is exactly midnight', () => {
    const midnightNow = new Date(2026, 10, 27, 0, 0, 0, 0);
    const entries = buildTimeline(snapshot, midnightNow);
    expect(entries[1].date).toEqual(new Date(2026, 10, 28, 0, 0, 0, 0));
  });

  it('keeps the placeholder snapshot as a single entry', () => {
    const entries = buildTimeline({ ...snapshot, date: '' }, now);
    expect(entries).toHaveLength(1);
    expect(entries[0].props.date).toBe('');
  });
});

describe('day helpers', () => {
  it('formats the local day key with zero padding', () => {
    expect(localDayKey(new Date(2026, 0, 5, 3, 0))).toBe('2026-01-05');
  });

  it('computes the next local midnight strictly after now', () => {
    expect(nextLocalMidnight(new Date(2026, 10, 27, 0, 0, 0, 0))).toEqual(new Date(2026, 10, 28));
  });
});

describe('publish', () => {
  const now = new Date(2026, 10, 27, 14, 30);

  it('hands the two-entry timeline to updateTimeline and logs it', () => {
    const widget = { updateTimeline: jest.fn(), reload: jest.fn() };
    const log = jest.fn();
    expect(publish(snapshot, { widget, now: () => now, log })).toBe(true);
    expect(widget.updateTimeline).toHaveBeenCalledTimes(1);
    expect(widget.updateTimeline).toHaveBeenCalledWith(buildTimeline(snapshot, now));
    expect(log).toHaveBeenCalledWith('widget-publish', expect.objectContaining({ entries: 2 }));
  });

  it('logs and returns false when the widget throws, never rethrows', () => {
    const widget = {
      updateTimeline: jest.fn(() => {
        throw new Error('native module missing');
      }),
      reload: jest.fn(),
    };
    const log = jest.fn();
    expect(() => publish(snapshot, { widget, now: () => now, log })).not.toThrow();
    expect(publish(snapshot, { widget, now: () => now, log })).toBe(false);
    expect(log).toHaveBeenCalledWith('widget-publish-failed', { message: 'native module missing' });
  });
});

describe('reload and foreground listener', () => {
  it('reload calls the widget and swallows failures', () => {
    const ok = { updateTimeline: jest.fn(), reload: jest.fn() };
    expect(reload({ widget: ok, log: jest.fn() })).toBe(true);
    expect(ok.reload).toHaveBeenCalledTimes(1);

    const bad = {
      updateTimeline: jest.fn(),
      reload: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const log = jest.fn();
    expect(reload({ widget: bad, log })).toBe(false);
    expect(log).toHaveBeenCalledWith('widget-reload-failed', { message: 'boom' });
  });

  it('reloads on active only and returns the subscription', () => {
    let listener: ((state: 'active' | 'background' | 'inactive') => void) | undefined;
    const remove = jest.fn();
    const appState: AppStateLike = {
      addEventListener: (_type, fn) => {
        listener = fn;
        return { remove };
      },
    };
    const widget = { updateTimeline: jest.fn(), reload: jest.fn() };
    const subscription = startForegroundReload({ appState, widget, log: jest.fn() });

    listener?.('background');
    listener?.('inactive');
    expect(widget.reload).not.toHaveBeenCalled();
    listener?.('active');
    expect(widget.reload).toHaveBeenCalledTimes(1);

    subscription.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('widgetSpikeAction', () => {
  it('is the frozen widget-publish action', () => {
    expect(widgetSpikeAction).toMatchObject({
      name: 'widget-publish',
      item: 'widget',
      title: 'Publish snapshot',
    });
  });

  it('fixture snapshot uses the local day key of the given time', () => {
    expect(fixtureSnapshot(new Date(2026, 10, 27, 8, 0)).date).toBe('2026-11-27');
  });
});
