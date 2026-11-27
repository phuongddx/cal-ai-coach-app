/**
 * The telemetry seam (PL-02, invariant I8): the allow-list and scrub of `AppEnvironment.swift`'s Sentry
 * and PostHog setup. No SDK is imported; the default sink sends nothing.
 */
import { ALLOWED_EVENT_NAMES, createTelemetry, isAllowListedText, scrubPayload, type TelemetryEvent } from './telemetry';

function makeTelemetry() {
  const events: TelemetryEvent[] = [];
  return { telemetry: createTelemetry({ sink: (event) => events.push(event) }), events };
}

describe('telemetry allow-list', () => {
  it('passes an event that is on the allow-list to the sink', () => {
    const { telemetry, events } = makeTelemetry();
    expect(ALLOWED_EVENT_NAMES).toContain('metrickit_metrics_received');
    expect(telemetry.track('metrickit_metrics_received', { count: 2 })).toBe(true);
    expect(events).toEqual([{ name: 'metrickit_metrics_received', payload: { count: 2 } }]);
  });

  it('drops an event that is not on the allow-list: the sink never hears of it', () => {
    const { telemetry, events } = makeTelemetry();
    expect(telemetry.track('meal_logged', { count: 1 })).toBe(false);
    expect(telemetry.track('scan_completed')).toBe(false);
    expect(events).toEqual([]);
  });

  it('sends nothing anywhere by default', () => {
    expect(createTelemetry().track('metrickit_metrics_received', { count: 1 })).toBe(true); // accepted, then discarded by the no-op sink
  });

  it('honors an allow-list given to it', () => {
    const events: TelemetryEvent[] = [];
    const telemetry = createTelemetry({ sink: (event) => events.push(event), allowedEvents: ['custom'] });
    expect(telemetry.track('custom')).toBe(true);
    expect(telemetry.track('metrickit_metrics_received')).toBe(false);
    expect(events.map((event) => event.name)).toEqual(['custom']);
  });
});

describe('telemetry scrub', () => {
  it('drops photo, health and calorie keys and text from a payload before the sink sees it', () => {
    const { telemetry, events } = makeTelemetry();
    telemetry.track('metrickit_diagnostics_received', {
      crashCount: 1,
      kcal: 640,
      photoUrl: 'file:///tmp/a.jpg',
      note: 'ate a Healthy meal',
      status: 'ok',
      weightKg: 82.4,
      nested: { hkSteps: 8000, depth: 3, label: 'diary entry' },
      list: ['fine', 'calorie count', 7],
    });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({
      crashCount: 1,
      status: 'ok',
      nested: { depth: 3 },
      list: ['fine', 7],
    });
  });

  it('drops values a sink cannot carry', () => {
    expect(scrubPayload({ a: undefined, b: () => 1, c: 'x', d: null, e: true })).toEqual({ c: 'x', d: null, e: true });
  });

  it('recognises the disallowed fragments without regard to case', () => {
    expect(isAllowListedText('PhotoLibrary')).toBe(false);
    expect(isAllowListedText('HealthKit')).toBe(false);
    expect(isAllowListedText('crash')).toBe(true);
    expect(isAllowListedText(null)).toBe(true);
  });
});
