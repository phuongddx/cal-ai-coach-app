import { createSyncEngine } from './engine';
import { FakeServer } from './fakeServer';
import { createInMemorySyncStore } from './inMemorySyncStore';
import { isOfflineFrom } from './offlineState';

describe('engine change notifications', () => {
  it('notifies after a run settles and when forced-offline flips, and exposes the last result', async () => {
    const onChange = jest.fn();
    const engine = createSyncEngine({
      store: createInMemorySyncStore(),
      transport: new FakeServer(),
      now: () => 1_764_200_000_000,
      isOnline: () => true,
      onChange,
    });

    await engine.bind('de000000-0000-4000-8000-000000000001');
    await engine.sync();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(engine.lastResult().status).toBe('synced');

    engine.setForcedOffline(true);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(engine.isOnline()).toBe(false);
  });
});

describe('isOfflineFrom', () => {
  it('is offline when the engine is offline or the server was unreachable', () => {
    expect(isOfflineFrom(false, 'offline')).toBe(true);
    expect(isOfflineFrom(true, 'retryScheduled')).toBe(true);
    expect(isOfflineFrom(true, 'synced')).toBe(false);
    expect(isOfflineFrom(true, 'quarantined')).toBe(false);
  });
});
