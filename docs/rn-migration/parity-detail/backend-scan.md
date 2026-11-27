# Parity detail: backend scan pipeline (U-11)

Rows BE-01, BE-02, BE-03, BE-08, BE-09, BE-10, BE-11 of `docs/rn-migration/parity.tsv`. Paths are
relative to the repository root. Deno sources are under `supabase/functions/`, TypeScript files under
`apps/api/src/`. Jest cases are named `<file> > <case sentence>`; the sentences are the Deno
`Deno.test` sentences.

SQL-backed cases run against PostgreSQL 17 through `TEST_OWNER_URL` and `TEST_API_URL` (see
`scripts/rn/start-api.sh`). Without those variables they print a `console.warn` and skip.

Note on BE-03: `parity.tsv` says `GET /v1/foods/search`, the brief and the implementation use
`POST /v1/foods/search` (the Deno function takes a JSON body). The row text is outside this unit's
scope; the owner decides whether to correct it.

## BE-01 Scan pipeline, `POST /v1/scan`

| Behaviour | Deno source | TS file | Proving Jest case |
|---|---|---|---|
| Fixed gate order: JSON parse 400, schema 400, auth 401, quota 402 | `analyze-food/index.ts` | `scan/route.ts`, `middleware.ts` | `scan/gates.test.ts > gate order: a malformed body on an unauthenticated call is 400, not 401` |
| Protected routes answer 401 unless `AUTH_DEV_TOKENS=1` | (Supabase JWT) | `middleware.ts` | `scan/gates.test.ts > gate order: without AUTH_DEV_TOKENS every protected route answers 401` |
| Malformed request shapes are 400 `VALIDATION_ERROR` before auth | `analyze-food/index.ts` | `scan/route.ts`, `http.ts` | `scan/analyze-food.e2e.test.ts > analyze-food: malformed request shapes are 400 VALIDATION_ERROR before auth` |
| Missing Authorization is a 401 envelope | `analyze-food/index.ts` | `middleware.ts` | `scan/analyze-food.e2e.test.ts > analyze-food: a missing Authorization header is a 401 envelope` |
| Photo scan returns computed kcal end to end | `analyze-food/index.ts` | `scan/pipeline.ts` | `scan/analyze-food.e2e.test.ts > analyze-food: photo scan returns computed kcal end-to-end` |
| Fixture photo scan returns the shared golden numbers | `tests/golden/` | `scan/pipeline.ts` | `scan/analyze-food.e2e.test.ts > analyze-food: the fixture photo scan returns the numbers of the shared golden response` |
| Replaying a scanId stays 200 with one `scan_usage` row | `analyze-food/index.ts` | `scan/pipeline.ts`, `quota.ts` | `scan/analyze-food.e2e.test.ts > analyze-food: replaying the same scanId stays 200 with one scan_usage row` |
| Malformed VLM output is a typed 422 | `analyze-food/index.ts` | `scan/pipeline.ts`, `vlm/fixture.ts` | `scan/analyze-food.e2e.test.ts > analyze-food: malformed VLM output is a typed 422, never a 500`; `scan/gates.test.ts > malformed fixture mode is a typed 422 with the env restored afterward` |
| Upstream outage is a retryable 502, never a bare 500 | `analyze-food/index.ts` | `scan/pipeline.ts`, `http.ts` | `scan/analyze-food.e2e.test.ts > analyze-food: an upstream provider outage is a retryable 502, never a bare 500` |
| Kind routing: barcode never calls a VLM; label, text, photo go to VLM tier 1, escalate to tier 2 | `analyze-food/index.ts`, `_shared/routing.ts` | `routing.ts`, `scan/pipeline.ts` | `modes.test.ts > routing: chooseTier escalates below the tier1 confidence floors`; `> escalate sentinel re-runs exactly once at tier2 and tier2 wins`; `> barcode scan performs zero VLM calls and grounds exact cache data` |
| Label scan grounds per-serving values through the arithmetic path; all unresolved is a typed 404 | `analyze-food/index.ts` | `scan/pipeline.ts` | `modes.test.ts > label scan grounds per-serving packaged values through the arithmetic path`; `> label scan with every item unresolved is a typed 404, never a guess` |
| Text scan is deterministic | `_shared/vlm/fixture.ts` | `vlm/fixture.ts` | `modes.test.ts > text scan is deterministic byte-for-byte across identical descriptions` |
| Malformed fixture mode on the label path is a typed 422 | `analyze-food/index.ts` | `scan/pipeline.ts` | `modes.test.ts > malformed fixture mode over the label path is a typed 422, never a 500` |
| Cascade delegates return cache hits and typed misses | `analyze-food/index.ts` | `grounding/cascade.ts` | `scan/analyze-food.e2e.test.ts > cascade skeleton: delegates return cache hits and typed misses` |
| Arithmetic: half-up rounding, macro precision, per-item sum | `_shared/arithmetic.ts` | `@coachcal/core` (already ported) | `arithmetic.test.ts` (8 cases, same sentences as `tests/arithmetic.test.ts`) |
| Wire contracts (strict objects, no kcal key, barcode regex) | `_shared/contracts/*.ts` | `@coachcal/api-contract` (already ported) | `contracts.test.ts` (18 cases) |
| Hidden-fat signal rides next to editable kcal | `_shared/hiddenFat.ts` | `hiddenFat.ts` | `hiddenFat.test.ts` (see BE-10) |

## BE-02 Barcode resolve, `POST /v1/barcode/resolve`

| Behaviour | Deno source | TS file | Proving Jest case |
|---|---|---|---|
| Seeded cache answers with zero provider calls | `barcode-resolve/index.ts` | `lookup/barcode.ts` | `lookup/barcode.test.ts > barcode-resolve: a seeded-cache barcode answers from cache with zero provider calls` |
| Unknown barcode with all-miss tiers is a typed 404 | `barcode-resolve/index.ts` | `lookup/barcode.ts` | `> barcode-resolve: an unknown barcode with all-miss tiers is a typed 404, never a guess` |
| Malformed shapes are 400 `VALIDATION_ERROR` | `barcode-resolve/index.ts` | `lookup/barcode.ts`, `http.ts` | `> barcode-resolve: malformed request shapes are 400 VALIDATION_ERROR` |
| Missing Authorization is a 401 envelope | `barcode-resolve/index.ts` | `middleware.ts` | `> barcode-resolve: a missing Authorization header is a 401 envelope` |
| Lookups never consume scan quota | `barcode-resolve/index.ts` | `lookup/barcode.ts` | `> barcode-resolve: lookups never consume scan quota` |
| A miss caches negatively for 24 h; the repeat does zero provider fetches | `_shared/grounding/cascade.ts` | `grounding/cascade.ts` | `> barcode-resolve: a miss caches negatively for 24h and the second lookup performs zero provider fetches` |

## BE-03 Food search, `POST /v1/foods/search`

| Behaviour | Deno source | TS file | Proving Jest case |
|---|---|---|---|
| Seeded cache row answers with zero provider calls | `food-search/index.ts` | `lookup/search.ts` | `lookup/search.test.ts > food-search: a seeded cache row answers with zero provider calls` |
| Unseeded query grounds from FDC and writes a 7-day cache row | `food-search/index.ts` | `lookup/search.ts`, `grounding/fdc.ts` | `> food-search: an unseeded query grounds from fdc and writes a 7-day-TTL cache row` |
| Zero-hit search is a typed 404 `FOOD_NOT_FOUND` | `food-search/index.ts` | `lookup/search.ts` | `> food-search: a zero-hit search is a typed 404 FOOD_NOT_FOUND` |
| Empty body and missing auth are typed refusals | `food-search/index.ts` | `lookup/search.ts`, `middleware.ts` | `> food-search: empty and missing-auth requests are typed refusals` |
| Lookups never consume scan quota | `food-search/index.ts` | `lookup/search.ts` | `> food-search: lookups never consume scan quota` |

## BE-08 Quota and entitlements

| Behaviour | Deno / SQL source | TS file | Proving Jest case |
|---|---|---|---|
| 4th free-tier scan in the window is 402 `FREE_LIMIT_REACHED` with the entitlement state | `_shared/quota.ts`, `claim_scan_credit` | `quota.ts`, `entitlement.ts` | `scan/gates.test.ts > quota: the 4th free-tier scan in the window is a 402 with entitlement state` |
| Replaying a consumed scanId after the limit stays 200, exactly 3 usage rows | `claim_scan_credit` | `quota.ts` | `> quota: replaying a consumed scanId after the limit stays 200 with exactly 3 usage rows` |
| Active entitlement bypasses the claim, an expired one does not | `_shared/entitlement.ts` | `entitlement.ts` | `> entitlement: an active entitlement bypasses the claim; an expired one does not` |
| `claim_scan_credit` succeeds for the caller and needs an authenticated user | `claim_scan_credit` | `db.ts` (`withUser`) | `privileges.test.ts > claim_scan_credit succeeds for the caller's own user and needs an authenticated user` |
| Claims count per caller | `claim_scan_credit` | `db.ts` | `> claim_scan_credit counts per caller: another user's claim never uses this user's quota` |
| `persist_scan` succeeds for the caller's own user | `persist_scan` | `scan/pipeline.ts` | `> persist_scan succeeds for the caller's own user` |
| `persist_scan` rejects rows of another user before any write | `persist_scan` | migration `20260914000000_scan_pipeline.sql` | `> persist_scan rejects another user's rows before any write` |

## BE-09 VLM provider

| Behaviour | Deno source | TS file | Proving Jest case |
|---|---|---|---|
| The Gemini `responseSchema` has no kcal-shaped key (I1) | `_shared/vlm/gemini.ts` | `vlm/gemini.ts` | `vlm/gemini-provider.test.ts > gemini: the request responseSchema carries no kcal-shaped key anywhere` |
| Tier 1 and tier 2 select distinct models | `_shared/vlm/gemini.ts` | `vlm/gemini.ts` | `> gemini: tier1 and tier2 select distinct models in the request URL` |
| `analyze()` returns raw parsed JSON, the caller validates | `_shared/vlm/gemini.ts` | `vlm/gemini.ts` | `> gemini: analyze() returns the raw parsed JSON unvalidated — the caller gates it` |
| Non-OK response throws `UpstreamError` | `_shared/vlm/gemini.ts` | `vlm/gemini.ts` | `> gemini: a non-OK response throws UpstreamError, never silently returns` |
| Network failure throws `UpstreamError` (502) | `_shared/vlm/gemini.ts` | `vlm/gemini.ts` | `> gemini: a network failure throws UpstreamError (502 upstream, not 500 internal)` |
| Live call returns schema-valid output | `_shared/vlm/gemini.ts` | `vlm/gemini.ts` | `> gemini: live call against the real API returns schema-valid output (skips without a key)` (skips without `GEMINI_API_KEY`) |
| Fixture provider and sentinels; the key stays on the server | `_shared/vlm/fixture.ts`, `provider.ts` | `vlm/fixture.ts`, `vlm/provider.ts` | `modes.test.ts` (sentinel cases above) and `contracts.test.ts > ScanRequestSchema has no client-settable fixture/mode field` |

## BE-10 Grounding cascade and hidden fat

| Behaviour | Deno source | TS file | Proving Jest case |
|---|---|---|---|
| FDC nutrient mapping (Atwater, SR-Legacy 1008, no kcal is a miss) | `_shared/grounding/fdc.ts` | `grounding/fdc.ts` | `grounding/cascade.test.ts > fdc: mapFdcNutrients ...` (3 cases) |
| GTIN-correct barcode normalization, UPC-A and EAN-13 variants | `_shared/grounding/normalize.ts`, `fdc.ts` | `grounding/normalize.ts`, `fdc.ts` | `> fdc: barcode normalization applies the GTIN-correct rules`; `> fdc: resolveBarcode queries both UPC-A and EAN-13 variants and matches gtinUpc` |
| Search takes the first parseable food; provider failure is `UpstreamError`; non-JSON is typed; abort timeout | `_shared/grounding/fdc.ts` | `grounding/fdc.ts` | `> fdc: resolveSearch ...`; `> fdc: provider failure ...`; `> fdc/off: a 200 non-JSON body ...`; `> fdc/off: upstream fetches carry an abort timeout` |
| Open Food Facts mapping and typed misses | `_shared/grounding/off.ts` | `grounding/off.ts` | `> off: ...` (2 cases) |
| FatSecret is a credential-gated stub | `_shared/grounding/fatsecret.ts` | `grounding/fatsecret.ts` | `> off/fatsecret: ...` (2 cases) |
| Tier precedence fdc, off, fatsecret; an fdc hit stops the chain | `_shared/grounding/cascade.ts` | `grounding/cascade.ts` | `> cascade: barcode precedence ...`; `> cascade: an fdc hit stops the tier chain` |
| Cache-first TTLs: 30 d positive barcode, 7 d search, 24 h negative | `_shared/grounding/cascade.ts` | `grounding/cacheStore.ts`, `cascade.ts` | `> cascade: ...` (9 cache cases: hit, expiry, negative, positive write, unknown write, repeat, search, search miss, upstream failure writes nothing) |
| Hidden-fat keyword heuristic and frozen vocabulary | `_shared/hiddenFat.ts` | `hiddenFat.ts` | `hiddenFat.test.ts > flagHiddenFat fires ...`, `> flagHiddenFat stays silent ...`, `> HIDDEN_FAT_KEYWORDS is a frozen vocabulary ...` |
| Hidden-fat flag on a scan, from the fixture and from the text description | `analyze-food/index.ts` | `hiddenFat.ts`, `scan/pipeline.ts` | `> caesar sentinel scan carries the fixture hidden-fat flag alongside editable kcal`; `> server-side heuristic fires the signal from the text description alone` |

## BE-11 Database schema and privileges

| Behaviour | Source | TS / SQL file | Proving Jest case |
|---|---|---|---|
| Three migrations ported plus one helper migration; `migrate(sql)` applies them to a fresh database and is idempotent | `supabase/migrations/20260912000000`, `20260914000000`, `20260914000001` | `apps/api/migrations/*.sql`, `migrate.ts` | `privileges.test.ts > migrate(sql) applies every migration to a fresh database and is idempotent` |
| `coachcal_api` holds no table privileges: a direct `SELECT` on `scans`, `scan_items`, `scan_usage`, `food_cache` fails | same | migrations (revokes and grants) | `privileges.test.ts > coachcal_api cannot SELECT directly from %s` (one per table: scans, scan_items, scan_usage, food_cache) |
| `coachcal_api` cannot write the scan tables directly | same | migrations | `> coachcal_api cannot write the scan tables directly either` |
| `persist_scan` and `claim_scan_credit` act only for the caller's own user | same | migrations, `db.ts` | cases under BE-08 |
| Every error body of the scan routes parses with `ErrorEnvelopeSchema` | `_shared/http.ts` | `http.ts` | `privileges.test.ts > every error body of the scan routes parses with ErrorEnvelopeSchema`; `contracts.test.ts > every ERROR_CODE builds a valid ErrorEnvelopeSchema value` |
| `GET /health` answers `{ ok: true, ... }` | (new) | `app.ts` | `privileges.test.ts > GET /health answers ok`; `app.test.ts > answers with ok` (spike test, kept) |

U-21 still owns wiring `sync_push` and `sync_pull` and gating `apply_webhook_event`.
