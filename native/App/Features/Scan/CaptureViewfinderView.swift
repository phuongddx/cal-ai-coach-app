import CoachCalDesignSystem
import CoachCalNetworking
import PhotosUI
import SwiftUI
import VisionKit

// UI-SPEC Group D viewfinder: near-black full-bleed, mode pill trio, 200pt
// alignment frame (lime guide), coach mark, zoom caption, 44/72/44 controls
// row. On the simulator the fixture seam renders a synthetic feed; barcode
// mode swaps the frame for the DataScanner reticle on device, or the photo
// picker + DetectBarcodesRequest path where DataScanner is unsupported.
struct CaptureViewfinderView: View {
  let model: ScanModel
  let mode: ScanMode
  let onModeChange: (ScanMode) -> Void
  let onLoggedElsewhere: () -> Void

  @State private var service: (any CameraCaptureService)?
  @State private var isCapturing = false
  @State private var pickedItem: PhotosPickerItem?
  @State private var isSearchPresented = false
  @State private var isCameraAccessDenied: Bool
  @State private var dataScannerFailed = false

  init(
    model: ScanModel,
    mode: ScanMode,
    onModeChange: @escaping (ScanMode) -> Void,
    onLoggedElsewhere: @escaping () -> Void,
    isCameraAccessDenied: Bool = false
  ) {
    self.model = model
    self.mode = mode
    self.onModeChange = onModeChange
    self.onLoggedElsewhere = onLoggedElsewhere
    _isCameraAccessDenied = State(initialValue: isCameraAccessDenied)
  }

  private var usesDataScanner: Bool {
    mode == .barcode && DataScannerViewController.isSupported && !dataScannerFailed
  }

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: 0) {
        modePills
        Spacer()
        viewfinderCore
        Spacer()
        controlsRow
          .padding(.bottom, CCSpace.xl2)
      }

      if case .failed(let failure) = model.phase {
        ScanErrorCard(
          failure: failure,
          onRetry: { model.retry() },
          onSearchManually: { isSearchPresented = true }
        )
      }
    }
    .sheet(isPresented: $isSearchPresented) {
      FoodSearchRoute(
        mealSlot: model.mealSlot,
        onSaved: { _ in
          isSearchPresented = false
          onLoggedElsewhere()
        },
        onDismiss: { isSearchPresented = false }
      )
      .presentationDetents([.large])
    }
    .task {
      if service == nil {
        service = ScanCaptureSeam.make(mode: mode)
      }
      if let cameraService = service as? CameraService {
        isCameraAccessDenied = !(await cameraService.requestAccessIfNeeded())
      }
      if !isCameraAccessDenied {
        service?.start()
      }
    }
    .onDisappear { service?.stop() }
    .task(id: pickedItem) {
      guard let item = pickedItem else { return }
      pickedItem = nil
      if let data = try? await item.loadTransferable(type: Data.self),
        let image = UIImage(data: data)
      {
        model.analyze(pickedImage: image, mode: mode)
      }
    }
  }

  private var modePills: some View {
    HStack(spacing: CCSpace.sm) {
      ForEach([ScanMode.photo, .barcode, .label], id: \.self) { pillMode in
        Button {
          if pillMode != mode {
            onModeChange(pillMode)
          }
        } label: {
          CCChipOption(title: title(for: pillMode), isSelected: pillMode == mode)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scan.modePill.\(pillMode.rawValue)")
      }
    }
    .padding(.top, CCSpace.xl)
    .accessibilityIdentifier("scan.modePill")
  }

  @ViewBuilder private var viewfinderCore: some View {
    if isCameraAccessDenied {
      CameraPermissionCard(onOpenSettings: openSettings)
        .accessibilityIdentifier("scan.cameraDenied")
    } else {
      VStack(spacing: CCSpace.md) {
      if usesDataScanner {
        DataScannerReticle(onStartFailure: {
          // startScanning can fail (permission revoked mid-session, sensor
          // busy) — fall back to the library picker instead of a dead reticle.
          DispatchQueue.main.async { dataScannerFailed = true }
        })
          .frame(width: 200, height: 200)
      } else if mode == .barcode {
        PhotosPicker(selection: $pickedItem, matching: .images) {
          barcodePickerCanvas
        }
        .buttonStyle(.plain)
        .frame(width: 200, height: 200)
        .accessibilityLabel("Choose from library")
      } else {
        alignmentFrame
      }
      coachMark
      if mode == .label {
        Text("Point at the nutrition label — text is read automatically")
          .ccFont(.footnote)
          .foregroundStyle(Color.white.opacity(0.7))
          .multilineTextAlignment(.center)
          .padding(.horizontal, CCSpace.xl2)
      } else {
        Text("1.0×")
          .ccFont(.caption)
          .fontWeight(.medium)
          .foregroundStyle(Color.white.opacity(0.7))
          .textCase(.uppercase)
          .accessibilityIdentifier("scan.zoom")
      }
      }
    }
  }

  private func openSettings() {
    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
    UIApplication.shared.open(url)
  }

  // 200pt alignment frame: 2pt lime @40% border, radius-lg, 3pt lime edge bars.
  private var alignmentFrame: some View {
    RoundedRectangle(cornerRadius: CCRadius.lg)
      .fill(Color.white.opacity(0.04))
      .frame(width: 200, height: 200)
      .overlay {
        if let service {
          service.preview
            .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
        }
      }
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.lg)
          .strokeBorder(Color.ccAccentLime.opacity(0.4), lineWidth: 2)
      )
      .overlay {
        GeometryReader { geometry in
          let bar = CGFloat(3)
          let inset = CGFloat(14)
          ForEach(0..<4, id: \.self) { corner in
            RoundedRectangle(cornerRadius: 2)
              .fill(Color.ccAccentLime)
              .frame(width: corner % 2 == 0 ? 28 : bar, height: corner % 2 == 0 ? bar : 28)
              .position(cornerPosition(corner, in: geometry.size, inset: inset))
          }
        }
      }
      .accessibilityHidden(true)
  }

  private func cornerPosition(_ corner: Int, in size: CGSize, inset: CGFloat) -> CGPoint {
    let x = corner == 0 || corner == 3 ? inset : size.width - inset
    let y = corner < 2 ? inset : size.height - inset
    return CGPoint(x: x, y: y)
  }

  private var barcodePickerCanvas: some View {
    RoundedRectangle(cornerRadius: CCRadius.lg)
      .strokeBorder(Color.ccAccentLime.opacity(0.4), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
      .background(Color.white.opacity(0.04))
      .overlay(
        VStack(spacing: CCSpace.xs) {
          Image(systemName: "barcode.viewfinder")
            .font(.system(size: 28))
            .foregroundStyle(Color.ccAccentLime)
          Text("Pick a barcode photo")
            .ccFont(.caption)
            .foregroundStyle(Color.white.opacity(0.7))
        }
      )
  }

  @ViewBuilder private var coachMark: some View {
    if mode != .barcode {
      Text("Center your food in the frame")
        .ccFont(.footnote)
        .foregroundStyle(Color.white)
        .padding(.vertical, CCSpace.sm)
        .padding(.horizontal, CCSpace.lg)
        .background(Color.black.opacity(0.8), in: Capsule())
        .accessibilityIdentifier("scan.coachMark")
    }
  }

  private var controlsRow: some View {
    HStack {
      libraryButton
        .accessibilityIdentifier("scan.library")
      Spacer()
      shutterButton
      Spacer()
      flipButton
        .accessibilityIdentifier("scan.flip")
    }
    .padding(.horizontal, CCSpace.xl2)
  }

  @ViewBuilder private var libraryButton: some View {
    if usesDataScanner {
      Color.clear.frame(width: 44, height: 44)
    } else {
      PhotosPicker(selection: $pickedItem, matching: .images) {
        Image(systemName: "photo.on.rectangle")
          .font(.system(size: 20))
          .foregroundStyle(Color.white)
          .frame(width: 44, height: 44)
          .background(Color.white.opacity(0.1), in: Circle())
          .contentShape(Circle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Choose from library")
    }
  }

  private var shutterButton: some View {
    Button {
      capture()
    } label: {
      if mode == .barcode && !usesDataScanner {
        shutterCircle.overlay(
          Image(systemName: "barcode.viewfinder")
            .font(.system(size: 26, weight: .semibold))
            .foregroundStyle(Color.black)
        )
      } else {
        shutterCircle
      }
    }
    .buttonStyle(.plain)
    .disabled(isCapturing || model.isAnalyzing || isCameraAccessDenied)
    .accessibilityLabel("Capture photo, button")
    .accessibilityIdentifier("scan.shutter")
  }

  private var shutterCircle: some View {
    Circle()
      .fill(Color.ccAccentLime)
      .frame(width: CCSize.shutter, height: CCSize.shutter)
      .overlay(
        Circle()
          .strokeBorder(Color.white.opacity(0.3), lineWidth: 4)
      )
      .contentShape(Circle())
  }

  private var flipButton: some View {
    Button {
      (service as? CameraService)?.flipCamera()
    } label: {
      Image(systemName: "arrow.triangle.2.circlepath.camera")
        .font(.system(size: 18))
        .foregroundStyle(Color.white)
        .frame(width: 44, height: 44)
        .background(Color.white.opacity(0.1), in: Circle())
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Flip camera")
  }

  private func capture() {
    guard let service, !isCapturing, !model.isAnalyzing else { return }
    isCapturing = true
    Task {
      defer { isCapturing = false }
      do {
        let captured = try await service.capture()
        model.analyze(with: captured)
      } catch {
        model.reportCaptureFailure()
      }
    }
  }

  private func title(for scanMode: ScanMode) -> String {
    switch scanMode {
    case .photo: "Scan Food"
    case .barcode: "Barcode"
    case .label: "Label"
    case .text: "Describe"
    }
  }
}

// Device reticle: DataScanner behind its own runtime availability checks —
// never constructed where isSupported is false (simulator, pre-A12).
private struct DataScannerReticle: View {
  let onStartFailure: () -> Void

  var body: some View {
    if DataScannerViewController.isSupported, DataScannerViewController.isAvailable {
      DataScannerRepresentable(onStartFailure: onStartFailure)
        .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
        .overlay(
          RoundedRectangle(cornerRadius: CCRadius.lg)
            .strokeBorder(Color.ccAccentLime.opacity(0.4), lineWidth: 2)
        )
    } else {
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccAccentLime.opacity(0.4), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
    }
  }
}

private struct DataScannerRepresentable: UIViewControllerRepresentable {
  let onStartFailure: () -> Void

  func makeUIViewController(context: Context) -> DataScannerViewController {
    let controller = DataScannerViewController(
      recognizedDataTypes: [.barcode(symbologies: [.ean8, .ean13, .code128, .qr])],
      qualityLevel: .balanced,
      recognizesMultipleItems: false,
      isHighFrameRateTrackingEnabled: false,
      isPinchToZoomEnabled: true,
      isGuidanceEnabled: true,
      isHighlightingEnabled: true
    )
    // Swallowed errors left the user with a dead reticle; surface them by
    // falling back to the PhotosPicker branch.
    do {
      try controller.startScanning()
    } catch {
      onStartFailure()
    }
    return controller
  }

  func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {}
}

// Camera permission card: the denial state's only surface — Settings deep
// link plus the library picker, which works without camera access.
struct CameraPermissionCard: View {
  let onOpenSettings: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: CCSpace.md) {
      HStack(spacing: CCSpace.sm) {
        Image(systemName: "video.slash")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityHidden(true)
        Text("Camera access is off")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
      }
      Text("CoachCal needs the camera to scan your meals. Turn it on in Settings, or pick a photo from your library instead.")
        .ccFont(.subhead)
        .foregroundStyle(Color.ccTextSecondary)
      CCSecondaryButton("Open Settings", bordered: true, action: onOpenSettings)
        .accessibilityIdentifier("scan.openSettings")
    }
    .padding(CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .padding(.horizontal, CCSpace.lg)
  }
}

// Inline error card — UI-SPEC: never a system alert. Verbatim copy per error
// fixture, with Try again / Search manually escape hatches.
struct ScanErrorCard: View {
  let failure: ScanModel.ScanFailure
  let onRetry: () -> Void
  let onSearchManually: () -> Void

  var heading: String {
    switch failure {
    case .barcodeNotFound: "We couldn't find that barcode"
    case .analysisFailure: "We couldn't analyze that photo"
    }
  }

  var message: String {
    switch failure {
    case .barcodeNotFound: "Search the food database or add it as a custom food."
    case .analysisFailure: "Try again, or add the food manually."
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: CCSpace.md) {
      HStack(spacing: CCSpace.sm) {
        Image(systemName: "exclamationmark.triangle")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(Color.ccErrorInk)
          .accessibilityHidden(true)
        Text(heading)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
      }
      Text(message)
        .ccFont(.subhead)
        .foregroundStyle(Color.ccTextSecondary)
      HStack(spacing: CCSpace.sm) {
        CCSecondaryButton("Try again", action: onRetry)
          .accessibilityIdentifier("scan.tryAgain")
        CCSecondaryButton("Search manually", bordered: true, action: onSearchManually)
          .accessibilityIdentifier("scan.searchManually")
      }
    }
    .padding(CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccError.opacity(0.3), lineWidth: 1)
    )
    .padding(.horizontal, CCSpace.lg)
  }
}
