import { z } from 'npm:zod';
import { getEntitlementState } from '../_shared/entitlement.ts';
import { getServiceClient, getUserClient } from '../_shared/db.ts';
import { errorJson, json, preflight, zodIssues } from '../_shared/http.ts';
import { claimScanCredit, freeLimitEnvelope } from '../_shared/quota.ts';
import { roundKcal, roundMacro, sumItemKcal } from '../_shared/arithmetic.ts';
import { resolveBarcode, resolveFood } from '../_shared/grounding/cascade.ts';
import { chooseTier } from '../_shared/routing.ts';
import { flagHiddenFat } from '../_shared/hiddenFat.ts';
import { getVlmProvider } from '../_shared/vlm/provider.ts';
import { UpstreamError } from '../_shared/contracts/food.ts';
import {
  ScanRequestSchema,
  ScanResponseSchema,
  type ScanItemResponse,
} from '../_shared/contracts/scan.ts';
import { VlmOutputSchema, type VlmOutput } from '../_shared/contracts/vlm.ts';

/**
 * analyze-food — the scan pipeline entrypoint. Gate order is fixed by the
 * RESEARCH architecture diagram: preflight → request parse → auth →
 * entitlement/quota → kind routing → VLM (photo/label/text, escalation
 * re-runs once at Tier-2) or direct cascade (barcode, no VLM) → grounding →
 * arithmetic → persist → respond. 500 INTERNAL is reserved for genuine bugs;
 * malformed VLM output is a typed 422 and malformed requests are typed 400s.
 */

const EMPTY_PER100G = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

export async function handler(req: Request): Promise<Response> {
  try {
    const cors = preflight(req);
    if (cors) return cors;

    const raw = await req.text();
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return errorJson(400, 'VALIDATION_ERROR', ['body must be valid JSON']);
    }
    const parsedRequest = ScanRequestSchema.safeParse(payload);
    if (!parsedRequest.success) {
      return errorJson(400, 'VALIDATION_ERROR', zodIssues(parsedRequest.error));
    }
    const request = parsedRequest.data;

    const userClient = getUserClient(req);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return errorJson(401, 'UNAUTHORIZED');
    const userId = authData.user.id;

    const serviceClient = getServiceClient();
    const entitlement = await getEntitlementState(serviceClient, userId);
    if (!entitlement.active) {
      const verdict = await claimScanCredit(userClient, request.scanId);
      if (!verdict.claimed) return json(402, freeLimitEnvelope(verdict));
    }

    let items: ScanItemResponse[];
    let scanConfidence: number;
    let note: string | null;

    if (request.kind === 'barcode') {
      // Exact packaged data — the barcode path never consults a VLM.
      // (The schema refine guarantees barcode presence; this guard only
      // satisfies narrowing and stays a typed 400 if ever reached.)
      const barcode = request.barcode;
      if (barcode === undefined) {
        return errorJson(400, 'VALIDATION_ERROR', ['payload must match kind']);
      }
      const grounded = await resolveBarcode(serviceClient, barcode);
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
      const vlmInput = request.kind === 'text'
        ? { kind: request.kind, textDescription: request.textDescription }
        : { kind: request.kind, imageBase64: request.imageBase64 };

      let vlmParsed: VlmOutput;
      try {
        vlmParsed = VlmOutputSchema.parse(
          await getVlmProvider().analyze(vlmInput, 'tier1'),
        );
      } catch (error) {
        if (error instanceof z.ZodError) {
          return errorJson(422, 'VLM_SCHEMA_ERROR', zodIssues(error));
        }
        throw error;
      }
      if (chooseTier(vlmParsed) === 'tier2') {
        try {
          vlmParsed = VlmOutputSchema.parse(
            await getVlmProvider().analyze(vlmInput, 'tier2'),
          );
        } catch (error) {
          if (error instanceof z.ZodError) {
            return errorJson(422, 'VLM_SCHEMA_ERROR', zodIssues(error));
          }
          throw error;
        }
      }

      items = [];
      for (const vlmItem of vlmParsed.items) {
        // Belt-and-braces LOG-09: the fixture/VLM flag OR the independent
        // heuristic — on the item label, plus the whole description for text.
        const hiddenFatLikely = vlmItem.hiddenFatLikely ||
          flagHiddenFat([vlmItem.label]) ||
          (request.kind === 'text'
            ? flagHiddenFat([request.textDescription ?? ''])
            : false);
        const grounded = await resolveFood(serviceClient, vlmItem.label);
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

    // Replay idempotency: the same scanId must be able to flow through again
    // (quota already collapses on (user_id, scan_id)), so persistence replaces.
    // The conflict target is user-scoped: a scanId is an idempotency key per
    // user, never a global identity another user could overwrite.
    const { error: scanError } = await serviceClient
      .from('scans')
      .upsert(
        { id: request.scanId, user_id: userId, kind: request.kind, meal_type: request.mealType ?? null },
        { onConflict: 'user_id,id' },
      );
    if (scanError) throw scanError;
    await serviceClient.from('scan_items')
      .delete()
      .eq('user_id', userId)
      .eq('scan_id', request.scanId);
    const { error: itemsError } = await serviceClient.from('scan_items').insert(
      items.map((item) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        scan_id: request.scanId,
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
      })),
    );
    if (itemsError) throw itemsError;

    // Self-check: an internally inconsistent response must surface as a bug
    // (500) here, never as an invalid contract shipped to the client.
    const response = ScanResponseSchema.parse({
      scanId: request.scanId,
      kind: request.kind,
      items,
      mealKcal: sumItemKcal(items),
      scanConfidence,
      note,
    });
    return json(200, response);
  } catch (error) {
    if (error instanceof UpstreamError) {
      return errorJson(502, 'UPSTREAM_ERROR');
    }
    return errorJson(500, 'INTERNAL');
  }
}

if (import.meta.main) Deno.serve(handler);
