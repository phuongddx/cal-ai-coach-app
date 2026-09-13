import { type VlmOutput, VlmOutputSchema } from '../contracts/vlm.ts';
import { type VlmInput, type VlmOutputLike, type VlmProvider, type VlmTier } from './provider.ts';

/**
 * Deterministic fixture VLM (Phase 2/3 default provider). Output is keyed by
 * sentinel image markers and a text hash — never randomness or time — so
 * identical input always yields identical output per tier. Mode is server
 * env only (VLM_FIXTURE_MODE), never request data; the optional constructor
 * argument exists for direct unit tests of this provider. Tier-2 outputs are
 * distinguishable from Tier-1 (scanConfidence 0.95 + note), and the escalate
 * sentinel forces Tier-2 selection by emitting a below-threshold
 * scanConfidence on the Tier-1 call.
 */

export type FixtureMode = 'normal' | 'malformed';

const ESCALATE_MARKER = 'fixture:escalate';
const LABEL_SENTINEL = 'fixture:nutrition-label';
const CAESAR_SENTINEL = 'fixture:caesar-salad';
const DEFAULT_LATENCY_MS = 650;
const MIN_LATENCY_MS = 400;
const MAX_LATENCY_MS = 900;
const TIER2_MARKER_NOTE = 'tier2 escalation';

function latencyMs(): number {
  const raw = Number(Deno.env.get('VLM_FIXTURE_LATENCY_MS'));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LATENCY_MS;
  return Math.min(Math.max(Math.round(raw), MIN_LATENCY_MS), MAX_LATENCY_MS);
}

function modeFromEnv(): FixtureMode {
  return Deno.env.get('VLM_FIXTURE_MODE') === 'malformed' ? 'malformed' : 'normal';
}

function tiered(base: VlmOutput, tier: VlmTier): VlmOutput {
  if (tier === 'tier1') return base;
  return VlmOutputSchema.parse({ ...base, scanConfidence: 0.95, note: TIER2_MARKER_NOTE });
}

const chickenRiceBase = VlmOutputSchema.parse({
  isFood: true,
  items: [
    {
      label: 'chicken-rice',
      grams: 320,
      gramsBasis: 'estimated',
      confidence: 0.92,
      hiddenFatLikely: false,
    },
  ],
  scanConfidence: 0.92,
  note: null,
});

// Same items at a below-floor scanConfidence: chooseTier must select Tier-2.
const escalateTier1 = VlmOutputSchema.parse({
  ...chickenRiceBase,
  scanConfidence: 0.55,
});

const nutritionLabelBase = VlmOutputSchema.parse({
  isFood: true,
  items: [
    {
      label: 'protein bar',
      grams: 60,
      gramsBasis: 'packaged-serving',
      confidence: 0.9,
      hiddenFatLikely: false,
    },
    {
      label: 'roasted almonds',
      grams: 15,
      gramsBasis: 'packaged-serving',
      confidence: 0.6,
      hiddenFatLikely: false,
    },
  ],
  scanConfidence: 0.9,
  note: null,
});

const caesarSaladBase = VlmOutputSchema.parse({
  isFood: true,
  items: [
    {
      label: 'caesar salad',
      grams: 250,
      gramsBasis: 'estimated',
      confidence: 0.88,
      hiddenFatLikely: true,
    },
  ],
  scanConfidence: 0.88,
  note: null,
});

const TEXT_BUCKETS: readonly VlmOutput[] = [
  VlmOutputSchema.parse({
    isFood: true,
    items: [
      { label: 'grilled chicken', grams: 200, gramsBasis: 'estimated', confidence: 0.85, hiddenFatLikely: false },
    ],
    scanConfidence: 0.85,
    note: null,
  }),
  VlmOutputSchema.parse({
    isFood: true,
    items: [
      { label: 'greek salad', grams: 300, gramsBasis: 'estimated', confidence: 0.8, hiddenFatLikely: false },
    ],
    scanConfidence: 0.8,
    note: null,
  }),
  VlmOutputSchema.parse({
    isFood: true,
    items: [
      { label: 'banana', grams: 118, gramsBasis: 'estimated', confidence: 0.75, hiddenFatLikely: false },
      { label: 'greek yogurt', grams: 170, gramsBasis: 'estimated', confidence: 0.7, hiddenFatLikely: false },
    ],
    scanConfidence: 0.75,
    note: null,
  }),
];

// FNV-1a: identical text always lands on the same bucket, so the canned set
// is deterministic without exposing the hash to callers.
function textBucket(description: string): VlmOutput {
  let hash = 0x811c9dc5;
  for (let i = 0; i < description.length; i++) {
    hash ^= description.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return TEXT_BUCKETS[hash % TEXT_BUCKETS.length];
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

function outputFor(input: VlmInput, tier: VlmTier): VlmOutputLike {
  if (input.imageBase64?.includes(ESCALATE_MARKER)) {
    return tier === 'tier1' ? escalateTier1 : tiered(chickenRiceBase, tier);
  }
  if (input.imageBase64?.includes(LABEL_SENTINEL)) return tiered(nutritionLabelBase, tier);
  if (input.imageBase64?.includes(CAESAR_SENTINEL)) return tiered(caesarSaladBase, tier);
  if (input.kind === 'text' && input.textDescription !== undefined) {
    return tiered(textBucket(input.textDescription), tier);
  }
  return tiered(chickenRiceBase, tier);
}

export class FixtureProvider implements VlmProvider {
  readonly #mode: FixtureMode;

  constructor(mode?: FixtureMode) {
    this.#mode = mode ?? modeFromEnv();
  }

  async analyze(input: VlmInput, tier: VlmTier): Promise<VlmOutputLike> {
    await new Promise((resolve) => setTimeout(resolve, latencyMs()));
    if (this.#mode === 'malformed') {
      return malformedOutput as unknown as VlmOutputLike;
    }
    return outputFor(input, tier);
  }
}
