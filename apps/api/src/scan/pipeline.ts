import {
  ScanResponseSchema,
  UpstreamError,
  VlmOutputSchema,
  type ScanItemResponse,
  type ScanRequest,
  type VlmOutput,
} from '@coachcal/api-contract';
import { roundKcal, roundMacro, sumItemKcal } from '@coachcal/core';
import { ZodError } from 'zod';

import type { Db } from '../db';
import { getEntitlementState } from '../entitlement';
import { resolveBarcode, resolveFood, type CascadeTiers } from '../grounding/cascade';
import { dbCacheStore } from '../grounding/cacheStore';
import { flagHiddenFat } from '../hiddenFat';
import { errorJson, json, zodIssues } from '../http';
import { claimScanCredit, freeLimitEnvelope } from '../quota';
import { chooseTier } from '../routing';
import { getVlmProvider, type VlmInput } from '../vlm/provider';

/**
 * The scan pipeline after the request gates (preflight, JSON parse, schema and auth live
 * in the route middleware, in that fixed order): entitlement/quota -> kind routing -> VLM
 * (photo/label/text, escalation re-runs once at Tier-2) or direct cascade (barcode, no VLM)
 * -> grounding -> arithmetic -> response self-parse -> persist_scan -> respond.
 * 500 INTERNAL is reserved for genuine bugs; malformed VLM output is a typed 422.
 * Ported from analyze-food/index.ts.
 *
 * Each database step is its own short `withUser` transaction, never one held across the
 * VLM and provider fetches. Like the original there is no quota refund on an upstream failure.
 */

const EMPTY_PER100G = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

export interface ScanDeps {
  db: Db;
  /** Test seam: substitutes the grounding tiers (default: the real FDC/OFF/FatSecret tiers). */
  tiers?: CascadeTiers;
}

export async function runScan(deps: ScanDeps, userId: string, request: ScanRequest): Promise<Response> {
  const { db } = deps;

  const blocked = await db.withUser(userId, async (query) => {
    const entitlement = await getEntitlementState(query);
    if (entitlement.active) return null;
    const verdict = await claimScanCredit(query, request.scanId);
    return verdict.claimed ? null : verdict;
  });
  if (blocked) return json(402, freeLimitEnvelope(blocked));

  const cache = dbCacheStore(db, userId);
  let items: ScanItemResponse[];
  let scanConfidence: number;
  let note: string | null;

  if (request.kind === 'barcode') {
    // Exact packaged data: the barcode path never consults a VLM. (The schema refine
    // guarantees barcode presence; this guard only satisfies narrowing.)
    const barcode = request.barcode;
    if (barcode === undefined) {
      return errorJson(400, 'VALIDATION_ERROR', ['payload must match kind']);
    }
    const grounded = await resolveBarcode(cache, barcode, deps.tiers);
    if (!('per100g' in grounded)) {
      return errorJson(404, 'BARCODE_NOT_FOUND', ['no grounding source resolved this barcode']);
    }
    items = [
      {
        label: `barcode:${barcode}`,
        grams: 100,
        gramsBasis: 'packaged-serving',
        confidence: 1,
        hiddenFatLikely: flagHiddenFat([`barcode:${barcode}`]),
        source: grounded.source,
        per100g: grounded.per100g,
        kcal: roundKcal(grounded.per100g.kcal, 100),
        proteinG: roundMacro(grounded.per100g.proteinG, 100),
        carbsG: roundMacro(grounded.per100g.carbsG, 100),
        fatG: roundMacro(grounded.per100g.fatG, 100),
        fiberG: roundMacro(grounded.per100g.fiberG, 100),
        unresolved: false,
      },
    ];
    scanConfidence = 1;
    note = null;
  } else {
    const vlmInput: VlmInput =
      request.kind === 'text'
        ? { kind: request.kind, textDescription: request.textDescription }
        : { kind: request.kind, imageBase64: request.imageBase64 };

    let vlmParsed: VlmOutput;
    try {
      vlmParsed = VlmOutputSchema.parse(await getVlmProvider().analyze(vlmInput, 'tier1'));
    } catch (error) {
      if (error instanceof ZodError) return errorJson(422, 'VLM_SCHEMA_ERROR', zodIssues(error));
      throw error;
    }
    if (chooseTier(vlmParsed) === 'tier2') {
      try {
        vlmParsed = VlmOutputSchema.parse(await getVlmProvider().analyze(vlmInput, 'tier2'));
      } catch (error) {
        if (error instanceof ZodError) return errorJson(422, 'VLM_SCHEMA_ERROR', zodIssues(error));
        throw error;
      }
    }

    items = [];
    for (const vlmItem of vlmParsed.items) {
      // Belt-and-braces LOG-09: the VLM flag OR the independent heuristic, on the item
      // label, plus the whole description for text.
      const hiddenFatLikely =
        vlmItem.hiddenFatLikely ||
        flagHiddenFat([vlmItem.label]) ||
        (request.kind === 'text' ? flagHiddenFat([request.textDescription ?? '']) : false);
      const grounded = await resolveFood(cache, vlmItem.label, deps.tiers);
      if (!('per100g' in grounded)) {
        items.push({
          label: vlmItem.label,
          grams: vlmItem.grams,
          gramsBasis: vlmItem.gramsBasis,
          confidence: vlmItem.confidence,
          hiddenFatLikely,
          source: 'none',
          per100g: EMPTY_PER100G,
          kcal: 0,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
          fiberG: 0,
          unresolved: true,
        });
        continue;
      }
      items.push({
        label: vlmItem.label,
        grams: vlmItem.grams,
        gramsBasis: vlmItem.gramsBasis,
        confidence: vlmItem.confidence,
        hiddenFatLikely,
        source: grounded.source,
        per100g: grounded.per100g,
        kcal: roundKcal(grounded.per100g.kcal, vlmItem.grams),
        proteinG: roundMacro(grounded.per100g.proteinG, vlmItem.grams),
        carbsG: roundMacro(grounded.per100g.carbsG, vlmItem.grams),
        fatG: roundMacro(grounded.per100g.fatG, vlmItem.grams),
        fiberG: roundMacro(grounded.per100g.fiberG, vlmItem.grams),
        unresolved: false,
      });
    }

    if (items.every((item) => item.unresolved)) {
      return errorJson(404, 'FOOD_NOT_FOUND', ['no grounding source resolved any item']);
    }

    scanConfidence = vlmParsed.scanConfidence;
    note = vlmParsed.note;
  }

  // Self-check BEFORE persistence: an internally inconsistent response must surface as a
  // bug (500) here, never persist half-validated state or ship an invalid contract.
  const response = ScanResponseSchema.parse({
    scanId: request.scanId,
    kind: request.kind,
    items,
    mealKcal: sumItemKcal(items),
    scanConfidence,
    note,
  });

  // Atomic persistence: the scans upsert and the replace-items delete+insert commit in
  // one function call, so a failed write can never leave a scan with its previous items
  // deleted and nothing written. The conflict target is user-scoped: a scanId is an
  // idempotency key per user, never a global identity another user could overwrite.
  const pScan = {
    id: request.scanId,
    user_id: userId,
    kind: request.kind,
    meal_type: request.mealType ?? null,
  };
  const pItems = items.map((item) => ({
    id: crypto.randomUUID(),
    label: item.label,
    grams: item.grams,
    per100g: item.per100g,
    kcal: item.kcal,
    macros: {
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      fiberG: item.fiberG,
    },
    confidence: item.confidence,
    hidden_fat_likely: item.hiddenFatLikely,
    source: item.source,
  }));
  await db.withUser(userId, (query) =>
    // postgres.js serialises jsonb parameters itself: pass the objects, never JSON strings.
    query('SELECT public.persist_scan($1::jsonb, $2::jsonb)', [pScan, pItems]),
  );
  return json(200, response);
}

/** Maps a thrown error to the typed envelope: UpstreamError -> 502, anything else -> 500. */
export function scanErrorResponse(error: unknown): Response {
  if (error instanceof UpstreamError) return errorJson(502, 'UPSTREAM_ERROR');
  console.error(`[api] 500 INTERNAL: ${error instanceof Error ? error.stack : String(error)}`);
  return errorJson(500, 'INTERNAL');
}
