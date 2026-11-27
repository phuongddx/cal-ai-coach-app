/**
 * Jest twin of native/Modules/CoachCalPersistence/Tests/CoachCalPersistenceTests/CSVExportServiceTests.swift —
 * one case per Swift test, the same behavior sentences.
 */
import { insights as insightsTable } from '../db/schema';
import { createCsvExportService, csvField, CSV_EXPORTED_TABLES } from './csvExport';
import { createRepoFixture, type RepoFixture } from './testing/fixtures';

const USER_ID = '04bbb783-bbe3-4a11-be45-6b77e3d23b20';

async function makeService(): Promise<{ fixture: RepoFixture; service: ReturnType<typeof createCsvExportService> }> {
  const fixture = await createRepoFixture();
  return { fixture, service: createCsvExportService(fixture.db) };
}

async function insertInsight(fixture: RepoFixture, title: string, body: string): Promise<void> {
  await fixture.db.insert(insightsTable).values({
    id: fixture.newId(),
    userId: USER_ID,
    day: '2026-09-15',
    kind: 'streak',
    title,
    body,
    createdAt: new Date(1_768_300_000_000).toISOString(),
  });
}

/** Naive RFC4180 field parser — only needs to invert csvField's own escaping. */
function parseCSVRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const chars = [...csv];
  let i = 0;
  while (i < chars.length) {
    const char = chars[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < chars.length && chars[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
    } else if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

describe('CSVExportServiceTests twins', () => {
  it('csvField escapes an embedded comma, quote and newline', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('the full export CSV round trips embedded edge cases per row', async () => {
    const { fixture, service } = await makeService();
    await insertInsight(fixture, 'Comma, here', 'plain body');
    await insertInsight(fixture, 'Quote "here"', 'plain body');
    await insertInsight(fixture, 'Newline title', 'line one\nline two');

    const data = await service.buildFullExportCSV(USER_ID);
    const csv = new TextDecoder().decode(data);
    const rows = parseCSVRows(csv);

    // insights columns (SELECT * order matches the migration's declaration
    // order): id, user_id, day, kind, title, body, created_at.
    const titles = rows.filter((row) => row.length > 5).map((row) => row[4]);
    const bodies = rows.filter((row) => row.length > 5).map((row) => row[5]);
    expect(titles).toContain('Comma, here');
    expect(titles).toContain('Quote "here"');
    expect(bodies).toContain('line one\nline two');
  });

  it('the full export CSV includes every canonical domain table', async () => {
    const { service } = await makeService();
    const data = await service.buildFullExportCSV(USER_ID);
    const csv = new TextDecoder().decode(data);

    // Cross-referenced with Migrations.swift's "3__domain_core" migration (11
    // tables + app_settings) plus "1__foundation_sync"'s diary_entries mirror —
    // pending_ops/sync_state are sync-internal bookkeeping, deliberately
    // excluded from this user-facing export.
    const canonicalDomainTables = [
      'user_targets', 'diary_entry_details', 'foods', 'saved_meals', 'custom_foods',
      'water_logs', 'weight_logs', 'exercise_logs', 'streak_state', 'badges', 'insights',
      'app_settings', 'diary_entries',
    ];
    expect(canonicalDomainTables).toEqual([...CSV_EXPORTED_TABLES]);
    for (const table of canonicalDomainTables) {
      expect(csv).toContain(`# ${table}\n`);
    }
  });
});
