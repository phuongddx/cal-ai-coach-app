import { File, Paths } from 'expo-file-system';

import { spikeLog } from './spikeLog';

let written = false;

/**
 * Writes the ISO time of the first Ember commit to `<document dir>/first-render.txt` once per process;
 * `scripts/measure.sh` polls for it to time a cold start (spec D5). Best effort: never throws.
 */
export function writeFirstRender(): string | null {
  if (written) return null;
  written = true;
  try {
    const iso = new Date().toISOString();
    const file = new File(Paths.document, 'first-render.txt');
    file.create({ overwrite: true });
    file.write(iso);
    spikeLog('ui', 'first-render', { iso, uri: file.uri });
    return iso;
  } catch (e) {
    spikeLog('ui', 'first-render-failed', { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
