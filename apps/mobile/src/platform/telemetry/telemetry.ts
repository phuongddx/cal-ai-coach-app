/**
 * The telemetry seam (PL-02, invariant I8): the port of the Sentry and PostHog setup in
 * `AppEnvironment.swift` (T-P46-01, T-P46-02). Feature code never calls an SDK; it calls
 * `track(name, payload)` on this seam, and only an allow-listed event name with a scrubbed payload
 * reaches the sink.
 *
 * No SDK is imported here and the default sink does nothing, so nothing leaves the device. U-50 adds
 * the Sentry and PostHog adapters as sinks, with the native slot.
 *
 * Scrub rule, as in `isAllowListedKey` / `isAllowListedText` / `isAllowListedBreadcrumbValue`: a key or
 * a text that contains a photo, image, scan, health, calorie or food fragment (any case) is dropped.
 * Swift filters the keys of the PostHog properties and the Sentry extra and tags, and the keys and
 * string values of a breadcrumb; this scrub applies both rules to every payload, recursively.
 */

/** `AppEnvironment.disallowedPayloadFragments`. */
export const DISALLOWED_PAYLOAD_FRAGMENTS: readonly string[] = [
  'photo',
  'image',
  'scan',
  'health',
  'hk',
  'kcal',
  'calorie',
  'weight',
  'meal',
  'food',
  'diary',
];

/**
 * The events that may leave the device: the MetricKit counts `reportMetricKitMetrics` and
 * `reportMetricKitDiagnostics` send in the Swift app. (PostHog's own app-lifecycle capture is
 * switched on in Swift; the SDK emits those events itself, so U-50 decides their names when it wires
 * the adapter.)
 */
export const ALLOWED_EVENT_NAMES: readonly string[] = ['metrickit_metrics_received', 'metrickit_diagnostics_received'];

export type TelemetryValue = string | number | boolean | null | TelemetryValue[] | { [key: string]: TelemetryValue };
export type TelemetryPayload = { [key: string]: TelemetryValue };

export type TelemetryEvent = { name: string; payload: TelemetryPayload };
export type TelemetrySink = (event: TelemetryEvent) => void;

export type Telemetry = {
  /** True when the event was handed to the sink; false when its name is not on the allow-list. */
  track(name: string, payload?: Readonly<Record<string, unknown>>): boolean;
};

/** `isAllowListedText`: false when the text names a photo, health or calorie thing. */
export function isAllowListedText(text: string | null | undefined): boolean {
  if (text === null || text === undefined) return true;
  const lowered = text.toLowerCase();
  return !DISALLOWED_PAYLOAD_FRAGMENTS.some((fragment) => lowered.includes(fragment));
}

/** `isAllowListedKey`: the same rule, for a payload key. */
export const isAllowListedKey = isAllowListedText;

function scrubValue(value: unknown): { keep: true; value: TelemetryValue } | { keep: false } {
  if (typeof value === 'string') return isAllowListedText(value) ? { keep: true, value } : { keep: false };
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return { keep: true, value };
  if (Array.isArray(value)) {
    const kept: TelemetryValue[] = [];
    for (const item of value) {
      const scrubbed = scrubValue(item);
      if (scrubbed.keep) kept.push(scrubbed.value);
    }
    return { keep: true, value: kept };
  }
  if (typeof value === 'object') return { keep: true, value: scrubPayload(value as Record<string, unknown>) };
  // undefined, functions, symbols, bigint: nothing a telemetry sink can carry.
  return { keep: false };
}

/** Drops every key and string value that names a photo, health or calorie thing; recurses into objects and arrays. */
export function scrubPayload(payload: Readonly<Record<string, unknown>>): TelemetryPayload {
  const scrubbed: TelemetryPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!isAllowListedKey(key)) continue;
    const result = scrubValue(value);
    if (result.keep) scrubbed[key] = result.value;
  }
  return scrubbed;
}

export type TelemetryOptions = {
  /** Where an allowed, scrubbed event goes. Default: nowhere (nothing leaves the device). */
  sink?: TelemetrySink;
  /** Default `ALLOWED_EVENT_NAMES`. */
  allowedEvents?: readonly string[];
};

export function createTelemetry(options: TelemetryOptions = {}): Telemetry {
  const sink: TelemetrySink = options.sink ?? (() => undefined);
  const allowed = new Set(options.allowedEvents ?? ALLOWED_EVENT_NAMES);
  return {
    track(name, payload = {}) {
      if (!allowed.has(name)) return false;
      sink({ name, payload: scrubPayload(payload) });
      return true;
    },
  };
}
