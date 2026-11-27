import type { SpikeItem } from './types';

/** One `[spike] {json}` line with an ISO timestamp: the machine-readable evidence (spec D5). */
export function spikeLog(item: SpikeItem, event: string, data?: Record<string, unknown>): void {
  console.log(`[spike] ${JSON.stringify({ ts: new Date().toISOString(), item, event, data: data ?? {} })}`);
}
