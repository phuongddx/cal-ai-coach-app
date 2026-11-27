/**
 * CSVExportService.swift's file half (TRU-03) — `SettingsDetailView.swift`'s `ShareLink`
 * shares a `CSVDocument` (a file), and `ProfileFlow.swift`'s `csvExportAction` only builds
 * the bytes. The generator is `data/repos/csvExport.ts` (U-12, not edited here); this
 * module writes its output to a cache file and hands the URL to the share sheet.
 *
 * Two entry points:
 * - `exportCsvAndShare()` writes the file and hands its URL to `expo-sharing` — the
 *   Swift CSVDocument path;
 * - `prepareCsvExport()` writes the file and returns the export text — today's
 *   `csvExportAction` binding (the model pre-computes it on screen load and the view
 *   shares it on tap; handing the URL to the share port on load would present the sheet
 *   whenever Settings opens, so the file share goes live when the view's tap moves to it).
 *
 * Both file and share are injected ports (the `File`/`Paths` API of expo-file-system and
 * `expo-sharing` are the defaults), so Jest proves the bytes and the URL with doubles.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface CsvExportFilePort {
  readonly uri: string;
  create(options: { overwrite: boolean }): void;
  write(contents: string): void;
}

export interface CsvExportDeps {
  /** The generator (`createCsvExportService(db).buildFullExportCSV`). */
  buildCsv(): Promise<Uint8Array>;
  /** Defaults to a new cache file of the given name. */
  createFile?(name: string): CsvExportFilePort;
  /** Defaults to `expo-sharing`'s share sheet. */
  share?(url: string): Promise<void>;
}

/** The share preview title of the Swift `ShareLink` — also the file name. */
export const CSV_EXPORT_FILE_NAME = 'CoachCal Data.csv';

function resolveFile(deps: CsvExportDeps): CsvExportFilePort {
  return deps.createFile ? deps.createFile(CSV_EXPORT_FILE_NAME) : new File(Paths.cache, CSV_EXPORT_FILE_NAME);
}

function resolveShare(deps: CsvExportDeps): (url: string) => Promise<void> {
  return deps.share ?? ((url) => Sharing.shareAsync(url, { mimeType: 'text/csv' }));
}

/** The bytes become the cache file; returns its URL and the exact text written. */
async function writeCsvExportFile(deps: CsvExportDeps): Promise<{ url: string; csv: string }> {
  const csv = new TextDecoder().decode(await deps.buildCsv());
  const file = resolveFile(deps);
  file.create({ overwrite: true });
  file.write(csv);
  return { url: file.uri, csv };
}

/** Writes the generator's output to the cache file, then hands the URL to the share sheet. */
export async function exportCsvAndShare(deps: CsvExportDeps): Promise<string> {
  const { url } = await writeCsvExportFile(deps);
  await resolveShare(deps)(url);
  return url;
}

/**
 * Writes the file and returns the export text — the `csvExportAction` binding: the row
 * stays disabled until it resolves, and the view shares what it produced.
 */
export async function prepareCsvExport(deps: CsvExportDeps): Promise<string> {
  const { csv } = await writeCsvExportFile(deps);
  return csv;
}
