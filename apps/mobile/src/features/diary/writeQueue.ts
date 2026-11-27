/**
 * A tiny in-process write queue for the diary's multi-statement writes. The
 * shared `inTransaction` seam does not serialize overlapping callers (U-12
 * finding; the serialized transactions are U-23's), so this unit's own batch
 * writes — re-log, manual save — queue behind one another instead.
 */
export type WriteQueue = <T>(task: () => Promise<T>) => Promise<T>;

export function createWriteQueue(): WriteQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    // Run regardless of the previous task's outcome; its own error goes to
    // its own caller, never to the next task.
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
