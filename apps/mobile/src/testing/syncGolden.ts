/**
 * Golden bodies of the sync wire (`PushRequest`, `PushResponse`, `PullResponse`) in the new
 * Meal-record shape. The Swift goldens under `native/` use the legacy `diary_entries` shape and no
 * longer decode against `@coachcal/api-contract`, so these are authored from the contract.
 */
const SYNC_GOLDEN = {
  sync_push_request: require('./fixtures/sync_push_request.golden.json'),
  sync_push_response: require('./fixtures/sync_push_response.golden.json'),
  sync_pull_response: require('./fixtures/sync_pull_response.golden.json'),
} as const satisfies Record<string, unknown>;

export type SyncGoldenName = keyof typeof SYNC_GOLDEN;

/** A deep copy, so a test can mutate it freely. */
export function syncGolden(name: SyncGoldenName): any {
  return JSON.parse(JSON.stringify(SYNC_GOLDEN[name]));
}
