/**
 * Capture viewfinder (Ember frame 01, + CameraPermissionCard and ScanErrorCard): near-black full-bleed camera,
 * a close glass button, 312 pt corner brackets in the accent, two guidance lines, the four mode chips
 * (Food / Barcode / Label / Describe) and the library / shutter / flip row. The fixture service paints the
 * bundled photo as the feed; the device service mounts the live `CameraView` (and its barcode reticle in
 * barcode mode). No flash button (the capture seam has no torch), no zoom readout, no free-scan chip.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';

import {
  darkColors,
  GlassIconButton,
  Icon,
  radius,
  Segment,
  SecondaryButton,
  size,
  space,
  typography,
  useTokens,
  withAlpha,
} from '../../design';
import { FIXTURE_MEAL_IMAGE, type CameraFacing, type ScanCaptureService } from './scanCapture';
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
  /** The close glass button: leaves the scan flow. Without it the button is not drawn. */
  onClose?: () => void;
  capture: ScanCaptureService;
  isCameraAccessDenied?: boolean;
  onOpenSettings?: () => void;
};

const MODE_OPTIONS: ReadonlyArray<{ value: ScanMode; label: string }> = [
  { value: 'photo', label: 'Food' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'label', label: 'Label' },
  { value: 'text', label: 'Describe' },
];
const FRAME = 312;
const BRACKET = 44;
const BRACKET_STROKE = 5;
const LIBRARY = 52;

export function CaptureViewfinderView({
  model,
  mode,
  onModeChange,
  onSearchManually,
  onClose,
  capture,
  isCameraAccessDenied = false,
  onOpenSettings = () => void Linking.openSettings(),
}: CaptureViewfinderViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const [denied, setDenied] = useState(isCameraAccessDenied);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>(capture.facing);
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

  function flipCamera(): void {
    setFacing(capture.flipCamera());
  }

  const shutterDisabled = isCapturing || state.isAnalyzing || denied;

  return (
    <View style={[styles.root, { backgroundColor: darkColors.bg }]}>
      <View style={styles.column}>
        <View style={styles.topBar}>
          {onClose !== undefined ? (
            <GlassIconButton icon="x" tone="overMedia" accessibilityLabel="Close" testID="scan.close" onPress={onClose} />
          ) : (
            <View style={styles.topSlot} />
          )}
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
                  facing={facing}
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] }}
                  onBarcodeScanned={({ data }) => {
                    if (scannedRef.current || state.isAnalyzing) return;
                    scannedRef.current = true;
                    model.analyze(capture.captureBarcode(data));
                  }}
                />
                <FrameBrackets />
              </View>
            ) : mode === 'barcode' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose from library"
                testID="scan.barcodePicker"
                onPress={() => void pickPhoto()}
                style={[styles.frame, styles.barcodeCanvas, { borderColor: withAlpha(colors.accent, 0.4) }]}
              >
                <Icon name="barcode" size={28} color={colors.accent} />
                <Text style={[typography.caption, { color: colors.emberText2 }]}>Pick a barcode photo</Text>
              </Pressable>
            ) : (
              <AlignmentFrame capture={capture} facing={facing} />
            )}
            {mode !== 'barcode' && (
              <View testID="scan.coachMark" style={styles.guidance}>
                <Text style={[styles.guidanceTitle, { color: colors.emberText }]}>Fit the whole plate in the frame</Text>
                {mode === 'label' ? (
                  <Text style={[styles.guidanceBody, { color: colors.emberText2 }]}>
                    Point at the nutrition label — the photo is analyzed to read it
                  </Text>
                ) : (
                  <Text style={[styles.guidanceBody, { color: colors.emberText2 }]}>Good light helps the estimate</Text>
                )}
              </View>
            )}
          </View>
        )}
        <View style={styles.spacer} />
        <Segment
          variant="chips"
          options={MODE_OPTIONS}
          value={mode}
          onChange={(next) => {
            if (next !== mode) onModeChange(next);
          }}
          accessibilityLabel="Scan mode"
          testID="scan.modePill"
        />
        <View style={styles.controls}>
          {usesLiveReticle ? (
            <View style={{ width: LIBRARY, height: LIBRARY }} />
          ) : (
            <GlassIconButton
              icon="image"
              tone="overMedia"
              diameter={LIBRARY}
              accessibilityLabel="Choose from library"
              testID="scan.library"
              onPress={() => void pickPhoto()}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: shutterDisabled }}
            testID="scan.shutter"
            disabled={shutterDisabled}
            onPress={() => void takePhoto()}
            style={[styles.shutter, { borderColor: colors.emberText, opacity: shutterDisabled ? 0.5 : 1 }]}
          >
            <View style={[styles.shutterCore, { backgroundColor: colors.accent }]}>
              {mode === 'barcode' && !usesLiveReticle && <Icon name="barcode" size={26} color={colors.onAccent} />}
            </View>
          </Pressable>
          <GlassIconButton
            icon="flip"
            tone="overMedia"
            diameter={LIBRARY}
            accessibilityLabel="Switch camera"
            accessibilityValueText={facing === 'back' ? 'Back camera' : 'Front camera'}
            testID="scan.flip"
            onPress={flipCamera}
          />
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

/** The four rounded corner brackets of the frame: accent, 5 pt stroke. */
function FrameBrackets() {
  const { colors } = useTokens();
  const corner = { position: 'absolute', width: BRACKET, height: BRACKET, borderColor: colors.accent } as const;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[corner, { top: 0, left: 0, borderTopWidth: BRACKET_STROKE, borderLeftWidth: BRACKET_STROKE, borderTopLeftRadius: radius.lg }]} />
      <View style={[corner, { top: 0, right: 0, borderTopWidth: BRACKET_STROKE, borderRightWidth: BRACKET_STROKE, borderTopRightRadius: radius.lg }]} />
      <View style={[corner, { bottom: 0, left: 0, borderBottomWidth: BRACKET_STROKE, borderLeftWidth: BRACKET_STROKE, borderBottomLeftRadius: radius.lg }]} />
      <View style={[corner, { bottom: 0, right: 0, borderBottomWidth: BRACKET_STROKE, borderRightWidth: BRACKET_STROKE, borderBottomRightRadius: radius.lg }]} />
    </View>
  );
}

function AlignmentFrame({ capture, facing }: { capture: ScanCaptureService; facing: CameraFacing }) {
  return (
    <View style={styles.frame} accessible={false} importantForAccessibility="no-hide-descendants">
      {capture.kind === 'device' ? (
        <CameraView ref={(handle) => capture.attachCamera(handle)} style={StyleSheet.absoluteFill} facing={facing} />
      ) : (
        <Image testID="scan.fixtureFeed" source={FIXTURE_MEAL_IMAGE} resizeMode="cover" style={StyleSheet.absoluteFill} />
      )}
      <FrameBrackets />
    </View>
  );
}

/** The denial state's only surface: the Settings deep link plus the library picker, which needs no camera. */
export function CameraPermissionCard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { colors } = useTokens();
  return (
    <View testID="scan.cameraDenied" style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeading}>
        <Icon name="camera" size={18} color={colors.text} />
        <Text style={[typography.headline, { color: colors.text }]}>Camera access is off</Text>
      </View>
      <Text style={[typography.subhead, { color: colors.text2 }]}>
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
        <Icon name="alert" size={18} color={colors.errorInk} />
        <Text style={[typography.headline, { color: colors.text }]}>{copy.heading}</Text>
      </View>
      <Text style={[typography.subhead, { color: colors.text2 }]}>{copy.message}</Text>
      <View style={styles.cardButtons}>
        <SecondaryButton title="Try again" action={onRetry} testID="scan.tryAgain" />
        <SecondaryButton title="Search manually" bordered action={onSearchManually} testID="scan.searchManually" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, alignItems: 'center', paddingBottom: space.xl3 },
  topBar: { alignSelf: 'stretch', flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.xl5 + space.md },
  topSlot: { width: size.tap, height: size.tap },
  spacer: { flex: 1 },
  core: { alignItems: 'center', gap: space.lg },
  frame: { width: FRAME, height: FRAME, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: withAlpha(darkColors.text, 0.04) },
  barcodeCanvas: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  guidance: { alignItems: 'center', gap: space.xs, paddingHorizontal: space.xl2 },
  guidanceTitle: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  guidanceBody: { fontSize: 13, fontWeight: '400', textAlign: 'center' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: space.xl2,
    paddingTop: space.lg,
  },
  shutter: { width: size.shutter, height: size.shutter, borderRadius: size.shutter / 2, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  errorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  card: { alignSelf: 'stretch', marginHorizontal: space.lg, padding: space.lg, borderRadius: radius.lg, gap: space.md },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardButtons: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
