import * as Linking from 'expo-linking';

import { runSpikeAction } from './registry';

export const SPIKE_SCHEME = 'ccspike';

/**
 * `ccspike://spike?action=seed` → `seed`. Anything else (other scheme, other host, no action)
 * returns null so the URL stays a plain navigation.
 */
export function parseSpikeUrl(url: string): string | null {
  return parseSpikeLink(url)?.name ?? null;
}

/** Like `parseSpikeUrl`, plus the other query parameters (`&rolloverInSeconds=90`). */
export function parseSpikeLink(url: string): { name: string; params: Record<string, string> } | null {
  const m = /^ccspike:\/\/([^/?#]*)\/?(?:\?([^#]*))?/i.exec(url.trim());
  if (!m || m[1].toLowerCase() !== 'spike') return null;
  const query = m[2] ?? '';
  let name = '';
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [k, v = ''] = pair.split('=');
    if (!k) continue;
    if (k === 'action') name = decodeURIComponent(v).trim();
    else params[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return name.length > 0 ? { name, params } : null;
}

/** Run the action a spike URL names. Returns the action name it ran, or null for other URLs. */
export async function handleSpikeUrl(url: string): Promise<string | null> {
  const link = parseSpikeLink(url);
  if (!link) return null;
  await runSpikeAction(link.name, link.params);
  return link.name;
}

/** Start listening (cold-start URL and later URLs). Returns a stop function. */
export function startSpikeDeepLinks(): () => void {
  void Linking.getInitialURL().then((url) => {
    if (url) void handleSpikeUrl(url);
  });
  const sub = Linking.addEventListener('url', ({ url }) => {
    void handleSpikeUrl(url);
  });
  return () => sub.remove();
}
