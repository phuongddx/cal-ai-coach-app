import {
  WidgetSnapshotStore,
  decodeWidgetSnapshot,
  encodeWidgetSnapshot,
} from './widgetSnapshot';

import type { WidgetSnapshot, WidgetSnapshotContainer } from './widgetSnapshot';

function inMemoryContainer(): { box: WidgetSnapshotContainer; data: () => string | null } {
  const state: { data: string | null } = { data: null };
  const box: WidgetSnapshotContainer = {
    read: () => state.data,
    write: (data) => {
      state.data = data;
    },
    remove: () => {
      state.data = null;
    },
  };
  return { box, data: () => state.data };
}

describe('WidgetSnapshot', () => {
  it('encode decode round trip preserves all fields', () => {
    const snapshot: WidgetSnapshot = {
      caloriesRemaining: 420,
      edSafeMode: true,
      updatedAt: new Date(1_700_000_000 * 1000).toISOString(),
    };
    const data = encodeWidgetSnapshot(snapshot);
    const decoded = decodeWidgetSnapshot(data);
    expect(decoded).toEqual(snapshot);
  });

  it('write is silent no-op when app group container is unavailable', () => {
    // The Swift suite runs outside any app's provisioning profile, so the App
    // Group container is never available there — this exercises the exact
    // "nil container" path a malformed/unprovisioned host would hit
    // (T-P45-02: defensive parsing, never a crash).
    const store = new WidgetSnapshotStore(null);
    store.write({ caloriesRemaining: 100, edSafeMode: false, updatedAt: new Date().toISOString() });
    expect(store.read()).toBeNull();
  });

  it('clear is silent no-op when app group container is unavailable', () => {
    // No crash is the assertion — nothing further to observe without a real container.
    expect(() => new WidgetSnapshotStore(null).clear()).not.toThrow();
  });

  it('read returns nil when nothing has been written', () => {
    const store = new WidgetSnapshotStore(inMemoryContainer().box);
    expect(store.read()).toBeNull();
  });

  it('store write and read round trip through the container', () => {
    const container = inMemoryContainer();
    const store = new WidgetSnapshotStore(container.box);
    const snapshot: WidgetSnapshot = { caloriesRemaining: 816, edSafeMode: false, updatedAt: '2026-11-27T11:00:00Z' };
    store.write(snapshot);
    expect(store.read()).toEqual(snapshot);
    expect(container.data()).toBe(encodeWidgetSnapshot(snapshot));
    store.clear();
    expect(store.read()).toBeNull();
  });

  it('a malformed payload decodes to nil instead of crashing', () => {
    expect(decodeWidgetSnapshot('not json at all')).toBeNull();
    expect(decodeWidgetSnapshot('{"caloriesRemaining":"NaN","edSafeMode":true,"updatedAt":"x"}')).toBeNull();
    expect(decodeWidgetSnapshot('{"caloriesRemaining":1}')).toBeNull();
  });
});
