import { type VlmOutput, VlmOutputSchema } from '../contracts/vlm.ts';
import { type VlmInput, type VlmOutputLike, type VlmProvider, type VlmTier } from './provider.ts';

/**
 * Deterministic fixture VLM (Phase 2/3 default provider). Output is keyed by a
 * sentinel label — text-hash keys arrive with plan 02-03's text mode. Mode is
 * server env only (VLM_FIXTURE_MODE), never request data; the optional
 * constructor argument exists for direct unit tests of this provider.
 */

export type FixtureMode = 'normal' | 'malformed';

const SENTINEL_KEY = 'fixture:chicken-rice';
const DEFAULT_LATENCY_MS = 650;
const MIN_LATENCY_MS = 400;
const MAX_LATENCY_MS = 900;

function latencyMs(): number {
  const raw = Number(Deno.env.get('VLM_FIXTURE_LATENCY_MS'));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LATENCY_MS;
  return Math.min(Math.max(Math.round(raw), MIN_LATENCY_MS), MAX_LATENCY_MS);
}

function modeFromEnv(): FixtureMode {
  return Deno.env.get('VLM_FIXTURE_MODE') === 'malformed' ? 'malformed' : 'normal';
}

function sentinelOutput(): VlmOutput {
  return VlmOutputSchema.parse({
    isFood: true,
    items: [
      {
        label: SENTINEL_KEY.replace(/^fixture:/, ''),
        grams: 320,
        gramsBasis: 'estimated',
        confidence: 0.92,
        hiddenFatLikely: false,
      },
    ],
    scanConfidence: 0.92,
    note: null,
  });
}

// The malformed payload carries an extra kcal key on the item — exactly the
// shape the strict no-kcal contract must reject, so the 422 path is provable.
const malformedOutput = {
  isFood: true,
  items: [
    {
      label: 'chicken-rice',
      grams: 320,
      gramsBasis: 'estimated',
      confidence: 0.92,
      hiddenFatLikely: false,
      kcal: 464,
    },
  ],
  scanConfidence: 0.92,
  note: null,
};

export class FixtureProvider implements VlmProvider {
  readonly #mode: FixtureMode;

  constructor(mode?: FixtureMode) {
    this.#mode = mode ?? modeFromEnv();
  }

  async analyze(_input: VlmInput, _tier: VlmTier): Promise<VlmOutputLike> {
    await new Promise((resolve) => setTimeout(resolve, latencyMs()));
    if (this.#mode === 'malformed') {
      return malformedOutput as unknown as VlmOutputLike;
    }
    return sentinelOutput();
  }
}
