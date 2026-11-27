import { ScanRequestSchema } from '@coachcal/api-contract';
import type { Hono } from 'hono';

import { barcodeLookup, barcodeRequestSchema } from '../lookup/barcode';
import { foodSearch, searchRequestSchema } from '../lookup/search';
import { requireUser, validateJson, type RequireUserOptions, type ScanAppEnv } from '../middleware';
import { runScan, scanErrorResponse, type ScanDeps } from './pipeline';

/**
 * The three scan-side routes, all behind one `requireUser`. Per-route chain, in the fixed
 * gate order: JSON parse (400) -> schema (400) -> auth (401) -> handler. A malformed body
 * therefore answers 400 even for an unauthenticated caller.
 */
export function registerScanRoutes(
  app: Hono<ScanAppEnv>,
  deps: ScanDeps,
  auth: RequireUserOptions = {},
): void {
  const user = requireUser(auth);

  app.post('/v1/scan', validateJson(ScanRequestSchema), user, async (c) => {
    try {
      return await runScan(deps, c.get('userId'), c.get('body') as never);
    } catch (error) {
      return scanErrorResponse(error);
    }
  });

  app.post('/v1/barcode/resolve', validateJson(barcodeRequestSchema), user, async (c) => {
    try {
      const { barcode } = c.get('body') as { barcode: string };
      return await barcodeLookup(deps.db, c.get('userId'), barcode, deps.tiers);
    } catch (error) {
      return scanErrorResponse(error);
    }
  });

  app.post('/v1/foods/search', validateJson(searchRequestSchema), user, async (c) => {
    try {
      const { query } = c.get('body') as { query: string };
      return await foodSearch(deps.db, c.get('userId'), query, deps.tiers);
    } catch (error) {
      return scanErrorResponse(error);
    }
  });
}
