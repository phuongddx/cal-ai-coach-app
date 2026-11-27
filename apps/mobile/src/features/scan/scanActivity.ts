/**
 * The Live Activity port of the scan flow (PL-12): `start`, `update`, `end`. This unit ships the no-op
 * implementation; U-43 puts the native one behind the same interface (it needs a native build).
 */
import type { ScanActivityPort } from './scanTypes';

export const noopScanActivity: ScanActivityPort = {
  async start() {
    return null;
  },
  async update() {},
  async end() {},
};

export type { ScanActivityPort } from './scanTypes';
