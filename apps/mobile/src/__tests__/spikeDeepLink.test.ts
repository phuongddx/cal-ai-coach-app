import { handleSpikeUrl, parseSpikeUrl } from '../spike/deepLink';
import { getLastRuns, registerSpikeAction, resetSpikeRegistry, runSpikeAction } from '../spike/registry';

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

beforeEach(() => {
  resetSpikeRegistry();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('parseSpikeUrl', () => {
  it('reads the action name from coachcal://spike?action=<name>', () => {
    expect(parseSpikeUrl('coachcal://spike?action=seed')).toBe('seed');
    expect(parseSpikeUrl('coachcal://spike/?action=health-save&x=1')).toBe('health-save');
    expect(parseSpikeUrl('coachcal://spike?x=1&action=force-offline')).toBe('force-offline');
  });

  it('ignores other schemes, other hosts and URLs without an action', () => {
    expect(parseSpikeUrl('https://example.com/spike?action=seed')).toBeNull();
    expect(parseSpikeUrl('coachcal://other?action=seed')).toBeNull();
    expect(parseSpikeUrl('coachcal://spike')).toBeNull();
    expect(parseSpikeUrl('coachcal://spike?action=')).toBeNull();
  });
});

describe('handleSpikeUrl', () => {
  it('runs the registered action the URL names and records its result for the console', async () => {
    const run = jest.fn(() => ({ status: 'ok' as const, summary: 'did it', data: { n: 1 } }));
    registerSpikeAction({ name: 'seed', item: 'ui', title: 'Seed', run });

    await expect(handleSpikeUrl('coachcal://spike?action=seed')).resolves.toBe('seed');

    expect(run).toHaveBeenCalledTimes(1);
    expect(getLastRuns().ui?.result).toEqual({ status: 'ok', summary: 'did it', data: { n: 1 } });
  });

  it('does nothing for a URL that is not a spike URL', async () => {
    const run = jest.fn(() => ({ status: 'ok' as const, summary: '' }));
    registerSpikeAction({ name: 'seed', item: 'ui', title: 'Seed', run });
    await expect(handleSpikeUrl('coachcal://progress')).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });
});

describe('runSpikeAction', () => {
  it('reports an unknown action as an error without throwing', async () => {
    await expect(runSpikeAction('nope')).resolves.toMatchObject({ status: 'error' });
  });

  it('turns a throwing action into an error result', async () => {
    registerSpikeAction({
      name: 'sync',
      item: 'sync',
      title: 'Sync',
      run: () => {
        throw new Error('boom');
      },
    });
    await expect(runSpikeAction('sync')).resolves.toEqual({ status: 'error', summary: 'boom' });
  });

  it('prints one [spike] line per event with an ISO timestamp', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    registerSpikeAction({ name: 'seed', item: 'ui', title: 'Seed', run: () => ({ status: 'ok', summary: 'x' }) });
    await runSpikeAction('seed');
    const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('[spike] '));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const first = JSON.parse(lines[0].slice('[spike] '.length));
    expect(first).toMatchObject({ item: 'ui', event: 'action-start', data: { name: 'seed' } });
    expect(new Date(first.ts).toISOString()).toBe(first.ts);
  });
});

describe('deep link parameters', () => {
  it('passes the extra query parameters to the action', async () => {
    const run = jest.fn((ctx: { params: Readonly<Record<string, string>> }) => ({
      status: 'ok' as const,
      summary: JSON.stringify(ctx.params),
    }));
    registerSpikeAction({ name: 'widget-publish', item: 'widget', title: 'Publish', run });

    await handleSpikeUrl('coachcal://spike?action=widget-publish&rolloverInSeconds=90');

    expect(run).toHaveBeenCalledTimes(1);
    expect(getLastRuns().widget?.result?.summary).toBe('{"rolloverInSeconds":"90"}');
  });
});
