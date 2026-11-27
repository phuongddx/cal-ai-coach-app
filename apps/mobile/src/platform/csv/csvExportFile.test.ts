/**
 * The file half of CSVExportService.swift (TRU-03): the generator's bytes become a cache
 * file, and the share port receives that file's URL. The generator is the real
 * `createCsvExportService` over a migrated sql.js store (the U-12 twin's fixture); file and
 * share are injected doubles, so the proof is exact bytes and exact URL.
 */

import { afterEach, describe, expect, it } from '@jest/globals';

jest.mock('expo-file-system', () => ({
  // The module's default factories reference these; the tests inject doubles, so the
  // real native module never loads in Jest.
  File: class {},
  Paths: { cache: {} },
}));

jest.mock('expo-sharing');

import { createCsvExportService } from '../../data/repos/csvExport';
import { createRepoFixture, type RepoFixture } from '../../data/repos/testing/fixtures';
import { exportCsvAndShare, prepareCsvExport, CSV_EXPORT_FILE_NAME } from './csvExportFile';

const USER_ID = '04bbb783-bbe3-4a11-be45-6b77e3d23b20';

function makeFileDouble() {
  const writes: string[] = [];
  const creates: Array<{ overwrite: boolean }> = [];
  return {
    writes,
    creates,
    port: {
      uri: `file:///cache/${CSV_EXPORT_FILE_NAME}`,
      create: (options: { overwrite: boolean }) => {
        creates.push(options);
      },
      write: (contents: string) => {
        writes.push(contents);
      },
    },
  };
}

async function withFixture(run: (fixture: RepoFixture) => Promise<void>): Promise<void> {
  const fixture = await createRepoFixture();
  await run(fixture);
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('csvExportFile — the export row of SettingsDetailView', () => {
  it('exportCsvAndShare writes the generator output to the file and the share port receives its URL', async () => {
    await withFixture(async (fixture) => {
      const generator = createCsvExportService(fixture.db);
      const file = makeFileDouble();
      const sharedUrls: string[] = [];

      const url = await exportCsvAndShare({
        buildCsv: () => generator.buildFullExportCSV(USER_ID),
        createFile: () => file.port,
        share: async (shared) => {
          sharedUrls.push(shared);
        },
      });

      const expected = new TextDecoder().decode(await generator.buildFullExportCSV(USER_ID));
      expect(file.writes).toEqual([expected]);
      expect(file.creates).toEqual([{ overwrite: true }]);
      expect(sharedUrls).toEqual([file.port.uri]);
      expect(url).toBe(file.port.uri);
    });
  });

  it('prepareCsvExport returns the generator output the view shares and writes the same file', async () => {
    await withFixture(async (fixture) => {
      const generator = createCsvExportService(fixture.db);
      const file = makeFileDouble();
      const sharedUrls: string[] = [];

      const csv = await prepareCsvExport({
        buildCsv: () => generator.buildFullExportCSV(USER_ID),
        createFile: () => file.port,
        share: async (shared) => {
          sharedUrls.push(shared);
        },
      });

      const expected = new TextDecoder().decode(await generator.buildFullExportCSV(USER_ID));
      expect(csv).toBe(expected);
      expect(file.writes).toEqual([expected]);
      expect(sharedUrls).toEqual([]); // the share sheet is the view's tap, not the load
    });
  });

  it('rewrites the same cache file on a second export', async () => {
    await withFixture(async (fixture) => {
      const generator = createCsvExportService(fixture.db);
      const file = makeFileDouble();
      const deps = {
        buildCsv: () => generator.buildFullExportCSV(USER_ID),
        createFile: () => file.port,
        share: async () => undefined,
      };

      await prepareCsvExport(deps);
      await prepareCsvExport(deps);

      expect(file.creates).toEqual([{ overwrite: true }, { overwrite: true }]);
      expect(file.writes).toHaveLength(2);
    });
  });
});
