/**
 * ScanFlowView.swift — the phase switch. capture/failed show the describe sheet in text mode and the viewfinder
 * otherwise (keyed by mode); analyzing, review, saved and quotaReached show their own screens. The model is built
 * once by the route; the initial mode comes from the route.
 */
import { useMemo, useState } from 'react';

import { AnalyzingView } from './AnalyzingView';
import { CaptureViewfinderView } from './CaptureViewfinderView';
import { DescribeMealSheet } from './DescribeMealSheet';
import { QuotaReachedView } from './QuotaReachedView';
import { ReviewSheetView } from './ReviewSheetView';
import { ScanSavedView } from './ScanSavedView';
import type { ScanCaptureService } from './scanCapture';
import type { ScanModel } from './scanModel';
import type { ScanMode } from './scanTypes';
import { useScanState } from './useScanModel';

export type ScanFlowViewProps = {
  model: ScanModel;
  initialMode: ScanMode;
  /** One capture service per mode (fixture or device); the route picks which. */
  createCapture: (mode: ScanMode) => ScanCaptureService;
  onClose: () => void;
  /** Food search escape (the route owns FoodSearchRoute); a meal logged there closes the flow. */
  onSearchManually?: () => void;
  /** Manual log escape of the quota card. */
  onLogManually: () => void;
  isCameraAccessDenied?: boolean;
  onOpenSettings?: () => void;
  animationsDisabled?: boolean;
};

export function ScanFlowView({
  model,
  initialMode,
  createCapture,
  onClose,
  onSearchManually,
  onLogManually,
  isCameraAccessDenied,
  onOpenSettings,
  animationsDisabled,
}: ScanFlowViewProps) {
  const state = useScanState(model);
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const capture = useMemo(() => createCapture(mode), [createCapture, mode]);

  switch (state.phase.kind) {
    case 'capture':
    case 'failed':
      return mode === 'text' ? (
        <DescribeMealSheet model={model} onSearchManually={onSearchManually} onBackToCamera={() => setMode('photo')} />
      ) : (
        <CaptureViewfinderView
          key={mode}
          model={model}
          mode={mode}
          onModeChange={setMode}
          onSearchManually={onSearchManually}
          onLoggedElsewhere={onClose}
          onClose={onClose}
          capture={capture}
          isCameraAccessDenied={isCameraAccessDenied}
          onOpenSettings={onOpenSettings}
        />
      );
    case 'analyzing':
      // The text scan keeps the describe sheet on screen (frame s-describe-estimating); the others take the full screen.
      if (mode === 'text') return <DescribeMealSheet model={model} onSearchManually={onSearchManually} onBackToCamera={() => setMode('photo')} />;
      return <AnalyzingView model={model} animationsDisabled={animationsDisabled} />;
    case 'review':
      return <ReviewSheetView model={model} onClose={onClose} />;
    case 'saved':
      return <ScanSavedView model={model} onViewDiary={onClose} onAddMore={() => model.startNewScan()} />;
    case 'quotaReached':
      return <QuotaReachedView model={model} onLogManually={onLogManually} />;
  }
}
