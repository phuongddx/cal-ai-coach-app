import { UpstreamError } from '../contracts/food.ts';
import { type VlmInput, type VlmOutputLike, type VlmProvider, type VlmTier } from './provider.ts';

/**
 * Real Gemini VLM provider (Phase 4 flip target). Mirrors FixtureProvider's
 * contract exactly: analyze() returns the model's JSON UNVALIDATED — the
 * caller's unchanged VlmOutputSchema.parse() (analyze-food/index.ts) is the
 * single validation point regardless of provider, so the no-kcal strictObject
 * contract is never relaxed for the "real" provider [VERIFIED:
 * supabase/functions/_shared/contracts/vlm.ts].
 *
 * Model name lives here ONLY (Pitfall 7): getVlmProvider() stays the one
 * switch point; no other file may branch on VLM_PROVIDER or hardcode a
 * gemini-3.* literal.
 *
 * All fetches flow through geminiFetch so tests stub one place (matches
 * fdcFetch/offFetch's FetchSeam convention).
 */

export type FetchSeam = (url: string, init?: RequestInit) => Promise<Response>;
export const geminiFetch: { impl: FetchSeam } = { impl: (url, init) => fetch(url, init) };

const DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_ESCALATION_MODEL = 'gemini-3.1-pro-preview';
const GEMINI_TIMEOUT_MS = 15_000;

// Mirrors VlmOutputSchema's shape 1:1 (contracts/vlm.ts) — no kcal-shaped key
// anywhere — so the strict no-kcal contract is enforced by the caller
// regardless of which provider produced the JSON.
export const GEMINI_VLM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFood: { type: 'BOOLEAN' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          grams: { type: 'NUMBER' },
          gramsBasis: {
            type: 'STRING',
            enum: ['estimated', 'reference-object', 'packaged-serving'],
          },
          confidence: { type: 'NUMBER' },
          hiddenFatLikely: { type: 'BOOLEAN' },
        },
        required: ['label', 'grams', 'gramsBasis', 'confidence'],
      },
    },
    scanConfidence: { type: 'NUMBER' },
    note: { type: 'STRING', nullable: true },
  },
  required: ['isFood', 'items', 'scanConfidence'],
} as const;

const PROMPT = [
  'Analyze the food shown (or described) and identify each distinct food item.',
  'For each item estimate grams, how that gram estimate was derived (gramsBasis),',
  'and your confidence in the identification (0-1). Set scanConfidence to your',
  'overall confidence in the full analysis. Set isFood to false if the input',
  'contains no food. Never estimate or output a calorie/kcal value of any kind —',
  'calories are computed deterministically downstream from grams alone.',
].join(' ');


interface GeminiGenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export class GeminiProvider implements VlmProvider {
  async analyze(input: VlmInput, tier: VlmTier): Promise<VlmOutputLike> {
    const model = tier === 'tier1'
      ? Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL
      : Deno.env.get('GEMINI_ESCALATION_MODEL') ?? DEFAULT_ESCALATION_MODEL;
    const parts = input.kind === 'text'
      ? [{ text: `${PROMPT}\n\nDescription: ${input.textDescription ?? ''}` }]
      : [
        { text: PROMPT },
        { inline_data: { mime_type: 'image/jpeg', data: input.imageBase64 ?? '' } },
      ];
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_VLM_SCHEMA,
      },
    };

    let response: Response;
    try {
      // A hung provider must not hold the request (and an already-claimed
      // scan credit) until the platform wall clock kills the function.
      response = await geminiFetch.impl(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${
          Deno.env.get('GEMINI_API_KEY') ?? ''
        }`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        },
      );
    } catch {
      throw new UpstreamError('gemini generateContent request failed');
    }
    if (!response.ok) throw new UpstreamError('gemini generateContent returned a non-OK status');

    let parsed: GeminiGenerateContentResponse;
    try {
      parsed = await response.json() as GeminiGenerateContentResponse;
    } catch {
      throw new UpstreamError('gemini generateContent returned a non-JSON body');
    }

    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new UpstreamError('gemini generateContent returned no text candidate');
    }

    // Returned UNVALIDATED — the caller's VlmOutputSchema.parse() (the
    // unchanged analyze-food/index.ts call site) is the single validation
    // point for every provider; GeminiProvider never parses/mutates it.
    try {
      return JSON.parse(text);
    } catch {
      throw new UpstreamError('gemini generateContent returned non-JSON text');
    }
  }
}
