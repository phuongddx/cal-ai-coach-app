import { Share, View, Text, Pressable } from 'react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';

import type { FoundationController, FoundationState } from './FoundationController';

/**
 * Device-only walking skeleton (Plan 01-05). Renders the bound owner's local
 * rows, queue status, and the redacted proof export. All behavior lives in the
 * controller — this component only binds state to the operator's screen.
 * Development-only surface: removed from product navigation after Phase 1.
 */

const STATUS_LABEL: Record<string, string> = {
  idle: 'Sync: idle',
  pending: 'Sync: changes queued',
  offline: 'Sync: offline — edits are saved locally',
};

export function SyncProbeScreen({
  controller,
  onExportProof,
}: {
  controller: FoundationController;
  onExportProof?: (proofJson: string) => void;
}) {
  const state = useSyncExternalStore(
    (onStoreChange) => controller.subscribe(onStoreChange),
    () => controller.getState()
  );

  const [status, setStatus] = useState('');

  useEffect(() => {
    setStatus(STATUS_LABEL[state.queueStatus] ?? `Sync: ${state.queueStatus}`);
  }, [state.queueStatus]);

  function exportProof(): void {
    const row = state.rows[0];
    if (!row) return;
    const proof = controller.buildRedactedProof('online', {
      rowId: row.id,
      opId: null,
      serverVersion: row.serverVersion,
      acceptedOpId: row.acceptedOpId,
      deletedAt: row.deletedAt,
      pendingCount: 0,
      submittedAtMs: null,
      acknowledgedAtMs: null,
      tombstone: row.deletedAt !== null,
    });
    const json = JSON.stringify(proof, null, 2);
    if (onExportProof) {
      onExportProof(json);
    } else {
      void Share.share({ message: json });
    }
  }

  return (
    <View className="flex-1 bg-surface-light p-4 dark:bg-surface-dark">
      <Text testID="sync-status" className="text-muted-light dark:text-muted-dark">
        {status}
      </Text>
      {state.rows.map((row) => (
        <View key={row.id} testID={`diary-row-${row.id}`} className="mt-2">
          <Text className="text-ink-light dark:text-ink-dark">{row.displayText}</Text>
        </View>
      ))}
      <Pressable
        testID="edit-row-button"
        className="mt-4 rounded bg-accent-lime p-3"
        onPress={() => {
          void controller.editRow(`edited at ${Date.now()}`);
        }}
      >
        <Text>Edit row</Text>
      </Pressable>
      <Pressable
        testID="export-proof-button"
        className="mt-2 rounded border border-muted-light p-3"
        onPress={exportProof}
      >
        <Text>Export redacted proof</Text>
      </Pressable>
    </View>
  );
}
