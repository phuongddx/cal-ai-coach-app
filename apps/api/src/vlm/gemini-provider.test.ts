import { UpstreamError, VlmOutputSchema } from '@coachcal/api-contract';

import { GEMINI_VLM_SCHEMA, GeminiProvider, geminiFetch } from './gemini';

/**
 * Request-shape and error-mapping tests run without GEMINI_API_KEY (they stub geminiFetch:
 * no live network call). The final test is the only one that touches the real API, and
 * skips cleanly (never fails closed) when the key is absent, per the plan's acceptance criteria.
 */

function candidateResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('gemini-provider', () => {
  it('gemini: the request responseSchema carries no kcal-shaped key anywhere', () => {
    // the Gemini responseSchema must never mention kcal (Pattern 5 / T-P42-01)
    expect(JSON.stringify(GEMINI_VLM_SCHEMA).toLowerCase().includes('kcal')).toBe(false);
  });

  it('gemini: tier1 and tier2 select distinct models in the request URL', async () => {
    const original = geminiFetch.impl;
    const urls: string[] = [];
    geminiFetch.impl = (url) => {
      urls.push(url);
      return Promise.resolve(candidateResponse({ isFood: true, items: [], scanConfidence: 0.9 }));
    };
    try {
      await new GeminiProvider().analyze({ kind: 'photo', imageBase64: 'aGVsbG8=' }, 'tier1');
      await new GeminiProvider().analyze({ kind: 'photo', imageBase64: 'aGVsbG8=' }, 'tier2');
    } finally {
      geminiFetch.impl = original;
    }
    expect(urls[0]).toContain('gemini-3.8-flash'); // tier1 must use the compiled-in default model
    expect(urls[1]).toContain('gemini-3.1-pro-preview'); // tier2 must use the escalation model
    expect(urls[0]).not.toBe(urls[1]); // tier1/tier2 must never share a model literal
  });

  it('gemini: analyze() returns the raw parsed JSON unvalidated — the caller gates it', async () => {
    const original = geminiFetch.impl;
    // Deliberately kcal-shaped and otherwise malformed: proves GeminiProvider does not validate
    // or mutate its own output (that would fail Pitfall 7's "GeminiProvider validates output
    // itself" regression check).
    const malformed = {
      isFood: true,
      items: [{ label: 'burger', grams: 200, gramsBasis: 'estimated', confidence: 0.9, kcal: 500 }],
      scanConfidence: 0.9,
    };
    geminiFetch.impl = () => Promise.resolve(candidateResponse(malformed));
    try {
      const result = await new GeminiProvider().analyze(
        { kind: 'photo', imageBase64: 'aGVsbG8=' },
        'tier1',
      );
      expect(result).toEqual(malformed); // the provider must pass the JSON through unchanged
      // the caller-side schema, not the provider, is what rejects the kcal key
      expect(() => VlmOutputSchema.parse(result)).toThrow();
    } finally {
      geminiFetch.impl = original;
    }
  });

  it('gemini: a non-OK response throws UpstreamError, never silently returns', async () => {
    const original = geminiFetch.impl;
    geminiFetch.impl = () => Promise.resolve(new Response('rate limited', { status: 429 }));
    try {
      await expect(
        new GeminiProvider().analyze({ kind: 'photo', imageBase64: 'aGVsbG8=' }, 'tier1'),
      ).rejects.toBeInstanceOf(UpstreamError);
    } finally {
      geminiFetch.impl = original;
    }
  });

  it('gemini: a network failure throws UpstreamError (502 upstream, not 500 internal)', async () => {
    const original = geminiFetch.impl;
    geminiFetch.impl = () => Promise.reject(new Error('network down'));
    try {
      await expect(
        new GeminiProvider().analyze({ kind: 'photo', imageBase64: 'aGVsbG8=' }, 'tier1'),
      ).rejects.toBeInstanceOf(UpstreamError);
    } finally {
      geminiFetch.impl = original;
    }
  });

  it('gemini: live call against the real API returns schema-valid output (skips without a key)', async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('SKIP: GEMINI_API_KEY not set — live gemini call test skipped, not failed');
      return;
    }
    // A known food photo fixture (1x1 placeholder here: an operator running this with a real
    // key should point at a real food photo for a meaningful isFood:true assertion; the
    // schema-validity assertion itself needs no particular image content).
    const output = await new GeminiProvider().analyze(
      { kind: 'photo', imageBase64: 'aGVsbG8=' },
      'tier1',
    );
    VlmOutputSchema.parse(output);
  });
});
