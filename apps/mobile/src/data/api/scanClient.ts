/**
 * The scan seam (`CoachCalAPI` in the Swift app): one `analyzeFood` over `POST /v1/scan`, parsed
 * with `ScanResponseSchema`, with the error envelope turned into `ScanApiError` and an optional
 * telemetry callback that reports the inferred tier. The wire contract is the relocated
 * `analyze-food` one: `textDescription` and `imageBase64` are the wire keys.
 */
import {
  ScanRequestSchema,
  ScanResponseSchema,
  type MealType,
  type ScanKind,
  type ScanRequest,
  type ScanResponse,
} from '@coachcal/api-contract';

import { newUuid } from '../sync/uuid';
import { apiRequest, isApiFailure, type ApiFailure, type BearerAuth } from './http';

export interface CoachCalApi {
  analyzeFood(request: ScanRequest): Promise<ScanResponse>;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type ScanApiErrorHelpers = {
  name: 'ScanApiError';
  /** 402 `FREE_LIMIT_REACHED`. */
  isQuotaReached: boolean;
  /** 404 `BARCODE_NOT_FOUND`. */
  isBarcodeNotFound: boolean;
  /** 422 `VLM_SCHEMA_ERROR`. */
  isSchemaError: boolean;
};

/** A decodable envelope keeps its code, details and entitlement; anything else keeps its kind. */
export type ScanApiError = ScanApiErrorHelpers &
  (
    | DistributiveOmit<ApiFailure, 'name'>
    /** The request failed `ScanRequestSchema` before leaving the device. */
    | { kind: 'invalidRequest'; message: string; issues: unknown[] }
  );

export function isScanApiError(value: unknown): value is ScanApiError {
  return typeof value === 'object' && value !== null && (value as { name?: unknown }).name === 'ScanApiError';
}

function scanApiError(
  failure: DistributiveOmit<ApiFailure, 'name'> | { kind: 'invalidRequest'; message: string; issues: unknown[] },
): ScanApiError {
  const code = failure.kind === 'envelope' ? failure.code : undefined;
  return {
    ...failure,
    name: 'ScanApiError',
    isQuotaReached: code === 'FREE_LIMIT_REACHED',
    isBarcodeNotFound: code === 'BARCODE_NOT_FOUND',
    isSchemaError: code === 'VLM_SCHEMA_ERROR',
  };
}

export type ScanRequestInput = {
  kind: ScanKind;
  /** Defaults to a fresh UUID v4, like the Swift initializer's default argument. */
  scanId?: string;
  mealType?: MealType;
  barcode?: string;
  /** Sent as `textDescription`. */
  text?: string;
  imageBase64?: string;
};

/** The `ScanRequest` of the Swift app: `text` travels as `textDescription`, `scanId` defaults. */
export function buildScanRequest(input: ScanRequestInput): ScanRequest {
  const { text, scanId, ...rest } = input;
  return {
    ...rest,
    scanId: scanId ?? newUuid().toLowerCase(),
    ...(text === undefined ? {} : { textDescription: text }),
  };
}

export type ScanTelemetryEvent = { tier: 'tier1' | 'tier2'; durationMs: number; escalated: boolean };

/** Past this the server almost certainly ran a tier-2 escalation: the wire response has no tier field. */
const ESCALATION_THRESHOLD_MS = 5_000;

export type LiveScanApiOptions = {
  auth: BearerAuth;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  onTelemetry?: (event: ScanTelemetryEvent) => void;
};

export class LiveScanApi implements CoachCalApi {
  constructor(private readonly options: LiveScanApiOptions) {}

  async analyzeFood(request: ScanRequest): Promise<ScanResponse> {
    const parsed = ScanRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw scanApiError({ kind: 'invalidRequest', message: 'the scan request failed the contract', issues: parsed.error.issues });
    }

    const now = this.options.now ?? Date.now;
    const startedAt = now();
    let response: ScanResponse;
    try {
      response = await apiRequest({
        method: 'POST',
        path: '/v1/scan',
        body: parsed.data,
        response: ScanResponseSchema,
        auth: this.options.auth,
        baseUrl: this.options.baseUrl,
        fetchImpl: this.options.fetchImpl,
      });
    } catch (error) {
      if (isApiFailure(error)) {
        const { name: _name, ...failure } = error;
        throw scanApiError(failure);
      }
      throw error;
    }

    const durationMs = now() - startedAt;
    const escalated = durationMs > ESCALATION_THRESHOLD_MS;
    this.options.onTelemetry?.({ tier: escalated ? 'tier2' : 'tier1', durationMs, escalated });
    return response;
  }
}
