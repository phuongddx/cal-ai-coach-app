export {
  ALLOWED_EVENT_NAMES,
  DISALLOWED_PAYLOAD_FRAGMENTS,
  createTelemetry,
  isAllowListedKey,
  isAllowListedText,
  scrubPayload,
} from './telemetry';
export type { Telemetry, TelemetryEvent, TelemetryOptions, TelemetryPayload, TelemetrySink, TelemetryValue } from './telemetry';
