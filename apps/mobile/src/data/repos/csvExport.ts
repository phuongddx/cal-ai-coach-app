/**
 * CSVExportService.swift — the complete local data inventory as one CSV, one
 * section per table (TRU-03). The generator is a pure function over the
 * database handle; writing the file is a later unit (U-42).
 *
 * Deliberately excludes pending_ops/sync_state: sync-machinery bookkeeping,
 * not the user's own domain data. Update `exportedTables` together with
 * schema.ts — drift is caught here by tests, not silently.
 */
import { sql } from 'drizzle-orm';

import type { SqlDb } from './sqlDb';

export const CSV_EXPORTED_TABLES = [
  'user_targets', 'diary_entry_details', 'foods', 'saved_meals', 'custom_foods',
  'water_logs', 'weight_logs', 'exercise_logs', 'streak_state', 'badges', 'insights',
  'app_settings', 'diary_entries',
] as const;

/**
 * RFC4180's real edge cases for this known schema: wrap-in-quotes + doubled
 * embedded quotes when a comma, quote, or newline is present.
 */
export function csvField(value: string): string {
  if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

/** Swift stringify(DatabaseValue): null → '', blob → '', numbers via String(). */
export function stringifyCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'string') return value;
  return '';
}

export function createCsvExportService(db: SqlDb) {
  return {
    /**
     * Reads every exported table wholesale, one `# <table>` section per
     * table; the header is written from the first row's column names, rows
     * follow, sections end with a blank line — exactly the Swift shape.
     */
    async buildFullExportCSV(userId: string): Promise<Uint8Array> {
      let csv = '';
      for (const table of CSV_EXPORTED_TABLES) {
        csv += `# ${table}\n`;
        const rows = await db.all<Record<string, unknown>>(sql.raw(`SELECT * FROM ${table}`));
        let wroteHeader = false;
        for (const row of rows) {
          const columns = Object.keys(row);
          if (!wroteHeader) {
            csv += columns.map(csvField).join(',') + '\n';
            wroteHeader = true;
          }
          csv += columns.map((column) => csvField(stringifyCsvValue(row[column]))).join(',') + '\n';
        }
        csv += '\n';
      }
      // userId documents the call-site contract for any future multi-account
      // support; no exported table is currently filtered by it (Swift parity).
      void userId;
      return new TextEncoder().encode(csv);
    },
  };
}

export type CsvExportService = ReturnType<typeof createCsvExportService>;
