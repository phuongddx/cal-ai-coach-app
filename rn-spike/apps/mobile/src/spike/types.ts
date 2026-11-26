/**
 * Shared shape of a spike console action (spec D5).
 *
 * Frozen while T1–T4 run in parallel: every task imports from this file and nobody edits it.
 * The registry, the `spikeLog` helper and the deep-link router that consume it live next to it
 * and belong to T1.
 */
export type SpikeItem = 'ui' | 'widget' | 'sync' | 'health';

export type SpikeActionName =
  | 'seed'
  | 'add-meal'
  | 'edit-meal'
  | 'delete-meal'
  | 'sync'
  | 'force-offline'
  | 'force-online'
  | 'reset'
  | 'health-request'
  | 'health-save'
  | 'health-read'
  | 'health-delete'
  | 'widget-publish';

export type SpikeActionStatus = 'ok' | 'error' | 'partial';

export type SpikeActionResult = {
  status: SpikeActionStatus;
  /** One line for the console's status line and the `[spike]` log. */
  summary: string;
  /** Anything worth showing as JSON on the console: ids, counts, rows. Never secrets. */
  data?: unknown;
};

/** Handed to `run` so an action can emit `[spike]` lines without importing the console code. */
export type SpikeActionContext = {
  log: (event: string, data?: Record<string, unknown>) => void;
};

export type SpikeAction = {
  name: SpikeActionName;
  item: SpikeItem;
  /** Button label on the console. */
  title: string;
  run: (ctx: SpikeActionContext) => Promise<SpikeActionResult> | SpikeActionResult;
};
