/**
 * The settings route (ProfileFlow.swift's navigationDestination): it builds the
 * settings model's real seams and hands the screen over (standing-order rule
 * 19). This file is the only place that spells the app-wide wellness storage
 * key and binds the design system's policy flag — the feature never holds the
 * policy branch (invariant I7; see parity-detail/profile-settings.md). The
 * route's tests live beside the screens in the feature, never under src/app.
 */
import { useEffect, useMemo } from 'react';

import { deleteAccount, resolveBaseUrl } from '../data/api';
import { getAuthServices, getSessionStore } from '../data/auth';
import { getDataEnvironment } from '../data/environment';
import { createCsvExportService } from '../data/repos/csvExport';
import { readAppSetting, writeAppSetting } from '../data/repos/engagementRepository';
import { DEMO_USER_ID } from '../data/repos/seedDataManager';
import { getSyncRuntime } from '../data/sync/runtime';
import { edSafeMode, setEdSafeMode } from '../design';

import { SettingsDetailView } from '../features/profile/SettingsDetailView';
import { createSettingsModel } from '../features/profile/settingsModel';

export default function SettingsRoute() {
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
      // U-51 replaces this binding with its full reset flow (the local-only
      // tables and the post-reset routing).
      deleteAccount: async () => {
        await deleteAccount({ auth: getSessionStore().bearer, baseUrl: resolveBaseUrl() });
      },
      resetSyncStore: async () => {
        (await getSyncRuntime()).store.reset();
      },
      signOut: () => getAuthServices().signOut(),
      csvExportAction: async () =>
        new TextDecoder().decode(
          await createCsvExportService((await getDataEnvironment()).db).buildFullExportCSV(ownerId),
        ),
    });
  }, []);
  useEffect(() => {
    void model.loadExport();
    void model.loadBurnAddBack();
  }, [model]);

  return <SettingsDetailView model={model} />;
}
