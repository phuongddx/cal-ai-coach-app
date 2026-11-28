/**
 * The settings route (ProfileFlow.swift's navigationDestination): it builds the
 * settings model's real seams and hands the screen over (standing-order rule
 * 19). This file is the only place that spells the app-wide ED-safe storage
 * key and binds the design system's policy flag — the feature never holds the
 * policy branch (invariant I7, standing-order rule 20); see
 * parity-detail/profile-settings.md. The route's tests live beside the screens
 * in the feature, never under src/app.
 *
 * U-77: the export tap is bound to `exportCsvAndShare` — the file, not the
 * text, goes to the share sheet, and the sheet's answer is mapped to
 * 'shared' | 'cancelled' from RN `Share.share`'s result (`action:
 * 'dismissedAction'` when the sheet is closed without sharing; expo-sharing's
 * `shareAsync` resolves void and cannot report the dismissal). Opening the
 * screen still only prepares the file (`prepareCsvExport`).
 */
import { useEffect, useMemo } from 'react';
import { Share } from 'react-native';

import { deleteAccount, resolveBaseUrl } from '../data/api';
import { getAuthServices, getSessionStore } from '../data/auth';
import { getDataEnvironment } from '../data/environment';
import { createCsvExportService } from '../data/repos/csvExport';
import { readAppSetting, writeAppSetting } from '../data/repos/engagementRepository';
import { DEMO_USER_ID } from '../data/repos/seedDataManager';
import { edSafeMode, setEdSafeMode } from '../design';
import { CSV_EXPORT_FILE_NAME, exportCsvAndShare, prepareCsvExport } from '../platform/csv/csvExportFile';
import { useAppEnvironment } from '../platform/appEnvironment';

import { SettingsDetailView } from '../features/profile/SettingsDetailView';
import { createSettingsModel } from '../features/profile/settingsModel';

export default function SettingsRoute() {
  const environment = useAppEnvironment();
  const model = useMemo(() => {
    const ownerId = getSessionStore().getSession()?.user.id ?? DEMO_USER_ID;
    return createSettingsModel({
      ownerId,
      // The app-wide storage key: U-51 reads the same key at launch. The value
      // format is '1'/'0' — do not change either.
      policyStorageKey: 'edSafeMode',
      burnAddBackStorageKey: 'burnAddBackEnabled',
      initialPolicyOn: edSafeMode(),
      applyPolicyFlag: setEdSafeMode,
      writeSetting: async (key, value) => {
        await writeAppSetting((await getDataEnvironment()).db, key, value);
      },
      readSetting: async (key) => readAppSetting((await getDataEnvironment()).db, key),
      deleteAccount: async () => {
        await deleteAccount({ auth: getSessionStore().bearer, baseUrl: resolveBaseUrl() });
      },
      // The model's local step is PR-22's full local reset (every table, both
      // stored flags, the design flag, the widget, the root gate) with the
      // remote step off — the model already ran the server cascade as step 1.
      resetLocalData: () => environment.resetLocalData({ deleteRemote: false }),
      signOut: () => getAuthServices().signOut(),
      // Preparing (on open): the generator's output becomes the cache file
      // (SettingsDetailView.swift pre-computes `exportedCSV` in `.task`).
      csvExportAction: () =>
        prepareCsvExport({
          buildCsv: async () =>
            createCsvExportService((await getDataEnvironment()).db).buildFullExportCSV(ownerId),
        }),
      // Sharing (on tap): `exportCsvAndShare` writes the cache file and hands
      // its URL to the injected share port — the system sheet with the file.
      // RN `Share.share` resolves with the sheet's answer; expo-sharing cannot
      // report a dismissal (its `shareAsync` resolves void).
      shareExport: async () => {
        let action = 'dismissedAction';
        await exportCsvAndShare({
          buildCsv: async () =>
            createCsvExportService((await getDataEnvironment()).db).buildFullExportCSV(ownerId),
          share: async (url) => {
            const result = await Share.share({ title: CSV_EXPORT_FILE_NAME, url });
            action = String(result.action);
          },
        });
        return action === 'sharedAction' ? 'shared' : 'cancelled';
      },
    });
  }, [environment]);
  useEffect(() => {
    void model.loadExport();
    void model.loadBurnAddBack();
  }, [model]);

  // Display-only entitlement state: Phase 3 is Free-only and no RN module
  // keeps a stored entitlement yet (see findings/U-41.md).
  return <SettingsDetailView model={model} planName="Free" />;
}
