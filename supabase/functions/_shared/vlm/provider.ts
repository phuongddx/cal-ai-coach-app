import { FixtureProvider } from './fixture.ts';

/**
 * VLM provider seam (RESEARCH Pattern 1). No call site knows which provider is
 * active: selection reads VLM_PROVIDER at call time — never at import time —
 * so the Phase 4 fixture→gemini flip is a config change only.
 */

export type VlmTier = 'tier1' | 'tier2';

export interface VlmInput {
  kind: 'photo' | 'label' | 'text';
  imageBase64?: string;
  textDescription?: string;
}

export interface VlmProvider {
  analyze(input: VlmInput, tier: VlmTier): Promise<VlmOutputLike>;
}

// Provider output is untrusted data: the handler strict-parses it against
// VlmOutputSchema before use, so the interface deliberately carries unknown.
export type VlmOutputLike = unknown;

let providerOverride: VlmProvider | null = null;

/** Test-only seam: suites install a counting/stub provider; null restores env selection. */
export function overrideVlmProvider(provider: VlmProvider | null): void {
  providerOverride = provider;
}

export function getVlmProvider(): VlmProvider {
  if (providerOverride) return providerOverride;
  const name = Deno.env.get('VLM_PROVIDER') ?? 'fixture';
  if (name === 'gemini') {
    throw new Error('VLM_PROVIDER=gemini is not implemented until Phase 4');
  }
  return new FixtureProvider();
}
