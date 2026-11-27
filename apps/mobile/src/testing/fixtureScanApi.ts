/**
 * The fixture scan client (`FixtureApiClient` and `FixtureModels` of the Swift app): replays the
 * golden files under `packages/api-contract/golden/` by scenario, parsed with the same strict
 * contract schemas as the live client. The held-out `200-unresolved` variant lives next to this
 * file so the golden directory stays a verbatim copy of the server contract.
 */
import { ErrorEnvelopeSchema, ScanResponseSchema, type ScanRequest, type ScanResponse } from '@coachcal/api-contract';

import type { CoachCalApi, ScanApiError } from '../data/api/scanClient';

export type FixtureScenario = '200' | '200-unresolved' | '402' | '404' | '422';

const SCENARIOS: readonly FixtureScenario[] = ['200', '200-unresolved', '402', '404', '422'];

export const SCENARIO_LAUNCH_ARGUMENT = '--ccScanScenario';

/** `--ccScanScenario <name>` from the launch arguments; anything unknown or missing is the golden 200. */
export function resolveFixtureScenario(argv: readonly string[]): FixtureScenario {
  const index = argv.indexOf(SCENARIO_LAUNCH_ARGUMENT);
  const value = index >= 0 ? argv[index + 1] : undefined;
  return SCENARIOS.find((scenario) => scenario === value) ?? '200';
}

const GOLDEN = {
  'scan-response-200': require('../../../../packages/api-contract/golden/scan-response-200.golden.json'),
  'scan-response-200-unresolved': require('./fixtures/scan-response-200-unresolved.golden.json'),
  'error-402-free-limit': require('../../../../packages/api-contract/golden/error-402-free-limit.golden.json'),
  'error-404-barcode-not-found': require('../../../../packages/api-contract/golden/error-404-barcode-not-found.golden.json'),
  'error-422-vlm-schema': require('../../../../packages/api-contract/golden/error-422-vlm-schema.golden.json'),
} as const satisfies Record<string, unknown>;

export type GoldenName = keyof typeof GOLDEN;

export function goldenFixture(name: GoldenName): unknown {
  return GOLDEN[name];
}

const ERROR_FIXTURE: Record<'402' | '404' | '422', GoldenName> = {
  '402': 'error-402-free-limit',
  '404': 'error-404-barcode-not-found',
  '422': 'error-422-vlm-schema',
};

function invalidResponse(message: string, issues?: unknown[]): ScanApiError {
  return {
    name: 'ScanApiError',
    kind: 'invalidResponse',
    status: 200,
    message,
    ...(issues ? { issues } : {}),
    isQuotaReached: false,
    isBarcodeNotFound: false,
    isSchemaError: false,
  };
}

export class FixtureScanApi implements CoachCalApi {
  constructor(
    private readonly scenario: FixtureScenario = '200',
    /** Test seam: where a golden body comes from. */
    private readonly source: { read: (name: GoldenName) => unknown } = { read: goldenFixture },
  ) {}

  async analyzeFood(_request: ScanRequest): Promise<ScanResponse> {
    if (this.scenario === '200' || this.scenario === '200-unresolved') {
      const name = this.scenario === '200' ? 'scan-response-200' : 'scan-response-200-unresolved';
      const parsed = ScanResponseSchema.safeParse(this.source.read(name));
      if (!parsed.success) {
        throw invalidResponse(`the fixture ${name} failed the scan contract`, parsed.error.issues);
      }
      return parsed.data;
    }

    const name = ERROR_FIXTURE[this.scenario];
    const envelope = ErrorEnvelopeSchema.safeParse(this.source.read(name));
    if (!envelope.success) {
      throw invalidResponse(`the fixture ${name} failed the error envelope contract`, envelope.error.issues);
    }
    const { code, details, entitlement } = envelope.data.error;
    const failure: ScanApiError = {
      name: 'ScanApiError',
      kind: 'envelope',
      status: Number(this.scenario),
      code,
      ...(details ? { details } : {}),
      ...(entitlement ? { entitlement } : {}),
      isQuotaReached: code === 'FREE_LIMIT_REACHED',
      isBarcodeNotFound: code === 'BARCODE_NOT_FOUND',
      isSchemaError: code === 'VLM_SCHEMA_ERROR',
    };
    throw failure;
  }
}

