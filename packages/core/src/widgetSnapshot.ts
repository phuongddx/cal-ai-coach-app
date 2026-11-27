/**
 * WidgetSnapshot.swift — the snapshot the host app writes for the widget
 * extension (ENG-04). The widget's timeline provider only ever reads it, so
 * `edSafeMode` travels inside the snapshot: it is the ONLY channel ED-Safe
 * state has to the widget process (Pitfall 6).
 *
 * The Swift type is Codable; `encodeWidgetSnapshot` / `decodeWidgetSnapshot`
 * are that codec here, and a missing or malformed payload decodes to `null`,
 * never a crash (T-P45-02). The App Group FILE layer is platform work (U-43);
 * core owns the type, the codec and the never-crash store contract over an
 * injectable container, mirroring the Swift store's silent no-op paths.
 */

export interface WidgetSnapshot {
  caloriesRemaining: number;
  /** The only ED-Safe channel to the widget process. */
  edSafeMode: boolean;
  /** ISO-8601 instant (Swift's `updatedAt: Date` in the App Group payload). */
  updatedAt: string;
}

/** The App Group file seam; `null` is the "container unavailable" path. */
export interface WidgetSnapshotContainer {
  read(): string | null;
  write(data: string): void;
  remove(): void;
}

export function encodeWidgetSnapshot(snapshot: WidgetSnapshot): string {
  return JSON.stringify(snapshot);
}

function isWidgetSnapshot(value: unknown): value is WidgetSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['caloriesRemaining'] === 'number' &&
    typeof candidate['edSafeMode'] === 'boolean' &&
    typeof candidate['updatedAt'] === 'string'
  );
}

export function decodeWidgetSnapshot(json: string): WidgetSnapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return isWidgetSnapshot(parsed) ? parsed : null;
}

/**
 * Read/write for the snapshot store. Both the host app and the widget link
 * this SAME type, so the shape is never independently duplicated across the
 * process boundary. A missing container (or a failed write) is a silent
 * no-op — never a crash (T-P45-02, T-P45-03).
 */
export class WidgetSnapshotStore {
  private readonly container: WidgetSnapshotContainer | null;

  constructor(container: WidgetSnapshotContainer | null) {
    this.container = container;
  }

  write(snapshot: WidgetSnapshot): void {
    if (this.container === null) {
      return;
    }
    try {
      this.container.write(encodeWidgetSnapshot(snapshot));
    } catch {
      // Silent no-op when the container is unavailable (T-P45-02) — never a crash.
    }
  }

  read(): WidgetSnapshot | null {
    if (this.container === null) {
      return null;
    }
    let data: string | null;
    try {
      data = this.container.read();
    } catch {
      return null;
    }
    return data === null ? null : decodeWidgetSnapshot(data);
  }

  /** Called on account reset so shared data never lingers past sign-out (T-P45-03). */
  clear(): void {
    if (this.container === null) {
      return;
    }
    try {
      this.container.remove();
    } catch {
      // Silent no-op (T-P45-03).
    }
  }
}
