/**
 * CaptureViewfinderView.swift (+ CameraPermissionCard, ScanErrorCard) — near-black full-bleed viewfinder:
 * mode pills, a 200pt alignment frame with lime corner bars, coach mark, zoom caption and the
 * 44/72/44 controls row. The fixture service paints the bundled photo as the feed; the device service
 * mounts the live `CameraView` (and its barcode reticle in barcode mode).
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { SymbolView } from 'expo-symbols';

import { ChipOption, radius, SecondaryButton, size, space, typography, useTokens, withAlpha } from '../../design';
import { FIXTURE_MEAL_IMAGE, type ScanCaptureService } from './scanCapture';
import type { ScanModel } from './scanModel';
import type { ScanFailure, ScanMode } from './scanTypes';
import { useScanState } from './useScanModel';

export type CaptureViewfinderViewProps = {
  model: ScanModel;
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  /** "Search manually": the route opens the food search; its save closes the flow. */
  onSearchManually?: () => void;
  onLoggedElsewhere: () => void;
  capture: ScanCaptureService;
  isCameraAccessDenied?: boolean;
  onOpenSettings?: () => void;
};

const MODE_TITLE: Record<'photo' | 'barcode' | 'label', string> = { photo: 'Scan Food', barcode: 'Barcode', label: 'Label' };
const PILL_MODES = ['photo', 'barcode', 'label'] as const;
const FRAME = 200;

export function CaptureViewfinderView({
  model,
  mode,
  onModeChange,
  onSearchManually,
  capture,
  isCameraAccessDenied = false,
  onOpenSettings = () => void Linking.openSettings(),
}: CaptureViewfinderViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const [denied, setDenied] = useState(isCameraAccessDenied);
  const [isCapturing, setIsCapturing] = useState(false);
  const scannedRef = useRef(false);

  // The fixture seam never reports denial; only the device service resolves permission (Swift `as? CameraService`).
  useEffect(() => {
    if (capture.kind !== 'device') return;
    let live = true;
    void capture.requestAccessIfNeeded().then((granted) => {
      if (live) setDenied(!granted);
    });
    return () => {
      live = false;
    };
  }, [capture]);

  useEffect(() => {
    scannedRef.current = false;
  }, [mode, state.phase.kind]);

  const usesLiveReticle = mode === 'barcode' && capture.kind === 'device' && !denied;

  async function takePhoto(): Promise<void> {
    if (isCapturing || state.isAnalyzing) return;
    setIsCapturing(true);
    try {
      model.analyze(await capture.capture());
    } catch {
      model.reportCaptureFailure();
    } finally {
      setIsCapturing(false);
    }
  }

  async function pickPhoto(): Promise<void> {
    if (state.isAnalyzing) return;
    try {
      const picked = await capture.pickFromLibrary();
      if (picked !== null) model.analyze(picked);
    } catch {
      model.reportCaptureFailure();
    }
  }

  const shutterDisabled = isCapturing || state.isAnalyzing || denied;

  return (
    <View style={styles.root}>
      <View style={styles.column}>
        <View style={styles.pills}>
          {PILL_MODES.map((pillMode) => (
            <View key={pillMode} testID={`scan.modePill.${pillMode}`}>
              <ChipOption
                title={MODE_TITLE[pillMode]}
                isSelected={pillMode === mode}
                onSelect={() => {
                  if (pillMode !== mode) onModeChange(pillMode);
                }}
              />
            </View>
          ))}
        </View>
        <View style={styles.spacer} />
        {denied ? (
          <CameraPermissionCard onOpenSettings={onOpenSettings} />
        ) : (
          <View style={styles.core}>
            {usesLiveReticle ? (
              <View style={styles.frame}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] }}
                  onBarcodeScanned={({ data }) => {
                    if (scannedRef.current || state.isAnalyzing) return;
                    scannedRef.current = true;
                    model.analyze(capture.captureBarcode(data));
                  }}
                />
                <FrameOutline />
              </View>
            ) : mode === 'barcode' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose from library"
                testID="scan.barcodePicker"
                onPress={() => void pickPhoto()}
                style={[styles.frame, styles.barcodeCanvas, { borderColor: withAlpha(colors.accentLime, 0.4) }]}
              >
                <SymbolView name="barcode.viewfinder" size={28} tintColor={colors.accentLime} />
                <Text style={styles.canvasText}>Pick a barcode photo</Text>
              </Pressable>
            ) : (
              <AlignmentFrame capture={capture} />
            )}
            {mode !== 'barcode' && (
              <View testID="scan.coachMark" style={styles.coachMark}>
                <Text style={styles.coachText}>Center your food in the frame</Text>
              </View>
            )}
            {mode === 'label' ? (
              <Text style={styles.labelHint}>Point at the nutrition label — text is read automatically</Text>
            ) : (
              <Text testID="scan.zoom" style={styles.zoom}>
                1.0×
              </Text>
            )}
          </View>
        )}
        <View style={styles.spacer} />
        <View style={styles.controls}>
          {usesLiveReticle ? (
            <View style={styles.circleButton} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
              testID="scan.library"
              onPress={() => void pickPhoto()}
              style={styles.circleButton}
            >
              <SymbolView name="photo.on.rectangle" size={20} tintColor="#FFFFFF" />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture photo, button"
            accessibilityState={{ disabled: shutterDisabled }}
            testID="scan.shutter"
            disabled={shutterDisabled}
            onPress={() => void takePhoto()}
            style={[styles.shutter, { backgroundColor: colors.accentLime }]}
          >
            {mode === 'barcode' && !usesLiveReticle && <SymbolView name="barcode.viewfinder" size={26} weight="semibold" tintColor="#000000" />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Flip camera" testID="scan.flip" style={styles.circleButton}>
            <SymbolView name="arrow.triangle.2.circlepath.camera" size={18} tintColor="#FFFFFF" />
          </Pressable>
        </View>
      </View>
      {state.phase.kind === 'failed' && (
        <View style={styles.errorOverlay}>
          <ScanErrorCard failure={state.phase.failure} onRetry={() => model.retry()} onSearchManually={() => onSearchManually?.()} />
        </View>
      )}
    </View>
  );
}

/** The 2pt lime @40% border and the four 3pt corner bars. */
function FrameOutline() {
  const { colors } = useTokens();
  const inset = 14;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, styles.outline, { borderColor: withAlpha(colors.accentLime, 0.4) }]} />
      {[0, 1, 2, 3].map((corner) => {
        const horizontal = corner % 2 === 0;
        const w = horizontal ? 28 : 3;
        const h = horizontal ? 3 : 28;
        const x = corner === 0 || corner === 3 ? inset : FRAME - inset;
        const y = corner < 2 ? inset : FRAME - inset;
        return (
          <View
            key={corner}
            style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: 2, backgroundColor: colors.accentLime }}
          />
        );
      })}
    </View>
  );
}

function AlignmentFrame({ capture }: { capture: ScanCaptureService }) {
  return (
    <View style={styles.frame} accessible={false} importantForAccessibility="no-hide-descendants">
      {capture.kind === 'device' ? (
        <CameraView ref={(handle) => capture.attachCamera(handle)} style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <Image testID="scan.fixtureFeed" source={FIXTURE_MEAL_IMAGE} resizeMode="cover" style={StyleSheet.absoluteFill} />
      )}
      <FrameOutline />
    </View>
  );
}

/** The denial state's only surface: the Settings deep link plus the library picker, which needs no camera. */
export function CameraPermissionCard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { colors } = useTokens();
  return (
    <View testID="scan.cameraDenied" style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeading}>
        <SymbolView name="video.slash" size={16} weight="semibold" tintColor={colors.textPrimary} />
        <Text style={[typography.headline, { color: colors.textPrimary }]}>Camera access is off</Text>
      </View>
      <Text style={[typography.subhead, { color: colors.textSecondary }]}>
        CoachCal needs the camera to scan your meals. Turn it on in Settings, or pick a photo from your library instead.
      </Text>
      <SecondaryButton title="Open Settings" bordered action={onOpenSettings} testID="scan.openSettings" />
    </View>
  );
}

export function scanErrorCopy(failure: ScanFailure): { heading: string; message: string } {
  return failure === 'barcodeNotFound'
    ? { heading: "We couldn't find that barcode", message: 'Search the food database or add it as a custom food.' }
    : { heading: "We couldn't analyze that photo", message: 'Try again, or add the food manually.' };
}

/** Inline error card: never a system alert. Verbatim copy per failure, with Try again / Search manually. */
export function ScanErrorCard({
  failure,
  onRetry,
  onSearchManually,
}: {
  failure: ScanFailure;
  onRetry: () => void;
  onSearchManually: () => void;
}) {
  const { colors } = useTokens();
  const copy = scanErrorCopy(failure);
  return (
    <View
      testID="scan.errorCard"
      style={[styles.card, { backgroundColor: colors.card, borderWidth: 1, borderColor: withAlpha(colors.error, 0.3) }]}
    >
      <View style={styles.cardHeading}>
        <SymbolView name="exclamationmark.triangle" size={16} weight="semibold" tintColor={colors.errorInk} />
        <Text style={[typography.headline, { color: colors.textPrimary }]}>{copy.heading}</Text>
      </View>
      <Text style={[typography.subhead, { color: colors.textSecondary }]}>{copy.message}</Text>
      <View style={styles.cardButtons}>
        <SecondaryButton title="Try again" action={onRetry} testID="scan.tryAgain" />
        <SecondaryButton title="Search manually" bordered action={onSearchManually} testID="scan.searchManually" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  column: { flex: 1, alignItems: 'center', paddingBottom: space.xl2 },
  pills: { flexDirection: 'row', gap: space.sm, paddingTop: space.xl4 + space.xl2 },
  spacer: { flex: 1 },
  core: { alignItems: 'center', gap: space.md },
  frame: { width: FRAME, height: FRAME, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' },
  outline: { borderWidth: 2, borderRadius: radius.lg },
  barcodeCanvas: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  canvasText: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
  coachMark: { backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 999, paddingVertical: space.sm, paddingHorizontal: space.lg },
  coachText: { ...typography.footnote, color: '#FFFFFF' },
  labelHint: { ...typography.footnote, color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingHorizontal: space.xl2 },
  zoom: { ...typography.caption, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: space.xl2 },
  circleButton: {
    width: size.tapTarget,
    height: size.tapTarget,
    borderRadius: size.tapTarget / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: size.shutter,
    height: size.shutter,
    borderRadius: size.shutter / 2,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  card: { alignSelf: 'stretch', marginHorizontal: space.lg, padding: space.lg, borderRadius: radius.lg, gap: space.md },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardButtons: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
