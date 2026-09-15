import AVFoundation
import CoachCalNetworking
import SwiftUI
import UIKit
import Vision
import VisionKit

// One capture result for both seams: the still image for the analyzing/review
// thumb plus the analyze request the capture mode implies.
struct ScanCapture {
  let image: UIImage?
  let request: ScanRequest
}

enum ScanCaptureError: Error {
  case emptyFrame
}

@MainActor
protocol CameraCaptureService: AnyObject {
  var preview: AnyView { get }
  // Resolves video permission before the session is configured: requests
  // access when undetermined, reports denial for the permission card.
  func requestAccessIfNeeded() async -> Bool
  func start()
  func stop()
  func capture() async throws -> ScanCapture
}

// The single device/simulator decision point (RESEARCH Pattern 6): the
// simulator has no camera and DataScanner needs A12 + live video, so the
// simulator always runs the fixture seam; --ccFixtureCapture (DEBUG) forces
// fixture on device for tests.
enum ScanCaptureSeam {
  static func make(mode: ScanMode) -> any CameraCaptureService {
    #if DEBUG
    if ProcessInfo.processInfo.arguments.contains("--ccFixtureCapture") {
      return FixtureCaptureService(mode: mode)
    }
    #endif
    #if targetEnvironment(simulator)
    return FixtureCaptureService(mode: mode)
    #else
    return CameraService(mode: mode)
    #endif
  }
}

// Simulator/test seam: returns the bundled fixture photo and passes a
// synthetic quality gate. No AVCaptureSession input is ever attempted.
final class FixtureCaptureService: CameraCaptureService {
  private let mode: ScanMode

  init(mode: ScanMode) {
    self.mode = mode
  }

  let preview: AnyView = AnyView(FixtureViewfinderCanvas())

  func start() {}
  func stop() {}

  // The fixture seam never touches AVCapture, so it is always "granted".
  func requestAccessIfNeeded() async -> Bool { true }

  func capture() async throws -> ScanCapture {
    // Stand-in for AE/AF settling so the shutter press has visible work.
    try await Task.sleep(nanoseconds: 120_000_000)
    let kind: ScanRequest.Kind = mode == .label ? .label : .photo
    return ScanCapture(image: ScanMedia.fixtureMealImage, request: ScanRequest(kind: kind))
  }
}

// Placeholder "feed" for the fixture seam — decorative, VoiceOver-hidden.
struct FixtureViewfinderCanvas: View {
  var body: some View {
    GeometryReader { geometry in
      ZStack {
        LinearGradient(
          colors: [Color.white.opacity(0.10), Color.white.opacity(0.03)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
        Circle()
          .fill(Color.ccAccentLime.opacity(0.08))
          .frame(width: geometry.size.width * 0.55)
          .offset(x: geometry.size.width * 0.18, y: geometry.size.height * 0.22)
        Circle()
          .fill(Color.white.opacity(0.05))
          .frame(width: geometry.size.width * 0.35)
          .offset(x: -geometry.size.width * 0.2, y: -geometry.size.height * 0.15)
      }
    }
    .accessibilityHidden(true)
  }
}

// Device seam: AVCaptureSession + AVCapturePhotoOutput behind the same
// protocol; barcode mode additionally records metadata strings.
final class CameraService: NSObject, CameraCaptureService {
  private let mode: ScanMode
  private let session = AVCaptureSession()
  private let photoOutput = AVCapturePhotoOutput()
  private let metadataOutput = AVCaptureMetadataOutput()
  private var configuredPosition: AVCaptureDevice.Position?
  private var lastBarcode: String?
  private var usesFrontCamera = false
  nonisolated(unsafe) private var inFlightDelegate: PhotoCaptureDelegate?

  init(mode: ScanMode) {
    self.mode = mode
    super.init()
  }

  var preview: AnyView { AnyView(CameraPreviewView(session: session)) }

  // Without this prompt the .notDetermined fresh-install path dead-ends:
  // AVCaptureDeviceInput creation fails and every capture throws into the
  // generic error card with no permission dialog ever shown.
  func requestAccessIfNeeded() async -> Bool {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
      return true
    case .notDetermined:
      return await AVCaptureDevice.requestAccess(for: .video)
    default:
      return false
    }
  }

  func start() {
    configureIfNeeded()
    if configuredPosition != nil {
      nonisolated(unsafe) let session = session
      Task.detached(priority: .userInitiated) {
        if !session.isRunning { session.startRunning() }
      }
    }
  }

  func stop() {
    nonisolated(unsafe) let session = session
    Task.detached(priority: .userInitiated) {
      if session.isRunning { session.stopRunning() }
    }
  }

  func capture() async throws -> ScanCapture {
    if mode == .barcode, let lastBarcode {
      return ScanCapture(image: nil, request: ScanRequest(kind: .barcode, barcode: lastBarcode))
    }
    configureIfNeeded()
    guard configuredPosition != nil else { throw ScanCaptureError.emptyFrame }

    let image: UIImage? = try await withCheckedThrowingContinuation { continuation in
      let delegate = PhotoCaptureDelegate { [weak self] result in
        Task { @MainActor [weak self] in
          self?.inFlightDelegate = nil
        }
        continuation.resume(with: result)
      }
      inFlightDelegate = delegate
      photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: delegate)
    }
    guard let image else { throw ScanCaptureError.emptyFrame }
    let kind: ScanRequest.Kind = mode == .label ? .label : .photo
    return ScanCapture(image: image, request: ScanRequest(kind: kind))
  }

  func flipCamera() {
    usesFrontCamera.toggle()
    configureIfNeeded(force: true)
  }

  private func configureIfNeeded(force: Bool = false) {
    let desired: AVCaptureDevice.Position = usesFrontCamera ? .front : .back
    guard force || configuredPosition != desired else { return }
    session.beginConfiguration()
    session.inputs.forEach(session.removeInput)
    session.outputs.forEach(session.removeOutput)

    guard
      let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: desired),
      let input = try? AVCaptureDeviceInput(device: device),
      session.canAddInput(input)
    else {
      session.commitConfiguration()
      configuredPosition = nil
      return
    }
    session.addInput(input)

    if session.canAddOutput(photoOutput) {
      session.addOutput(photoOutput)
    }
    if mode == .barcode, session.canAddOutput(metadataOutput) {
      session.addOutput(metadataOutput)
      metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue(label: "com.nextlabs.coachcal.metadata"))
      metadataOutput.metadataObjectTypes = [.ean8, .ean13, .code128, .code39, .qr]
    }
    session.commitConfiguration()
    configuredPosition = desired
  }
}

extension CameraService: AVCaptureMetadataOutputObjectsDelegate {
  // Delegate callbacks arrive on a background queue; hop to the MainActor
  // (RESEARCH Pitfall 1) before touching actor-isolated state.
  nonisolated func metadataOutput(
    _ output: AVCaptureMetadataOutput,
    didOutput metadataObjects: [AVMetadataObject],
    from connection: AVCaptureConnection
  ) {
    guard let code = metadataObjects.compactMap({ $0 as? AVMetadataMachineReadableCodeObject }).first,
      let stringValue = code.stringValue
    else { return }
    Task { @MainActor in
      self.lastBarcode = stringValue
    }
  }
}

final class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
  private let completion: @MainActor (Result<UIImage?, Error>) -> Void

  init(completion: @MainActor @escaping (Result<UIImage?, Error>) -> Void) {
    self.completion = completion
  }

  nonisolated func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    let image = photo.fileDataRepresentation().flatMap(UIImage.init(data:))
    let result: Result<UIImage?, Error> = error.map(Result.failure) ?? .success(image)
    Task { @MainActor in
      self.completion(result)
    }
  }
}

struct CameraPreviewView: UIViewRepresentable {
  let session: AVCaptureSession

  final class PreviewUIView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
  }

  func makeUIView(context: Context) -> PreviewUIView {
    let view = PreviewUIView()
    view.previewLayer.session = session
    view.previewLayer.videoGravity = .resizeAspectFill
    return view
  }

  func updateUIView(_ uiView: PreviewUIView, context: Context) {}
}

// Client-side image analysis for the simulator/library paths (system Vision
// framework, iOS 18 request API): barcode strings from picked photos and the
// label-mode OCR assist hint.
enum ScanImageAnalysis {
  static func detectBarcode(in image: UIImage) async -> String? {
    guard let cgImage = image.cgImage else { return nil }
    let results = try? await DetectBarcodesRequest().perform(on: cgImage)
    return results?.compactMap(\.payloadString).first
  }

  static func recognizeText(in image: UIImage) async -> String? {
    guard let cgImage = image.cgImage else { return nil }
    let observations = try? await RecognizeTextRequest().perform(on: cgImage)
    let text = observations?
      .flatMap { $0.topCandidates(1).map(\.string) }
      .joined(separator: " ")
    guard let text, !text.isEmpty else { return nil }
    return text
  }
}

enum ScanMedia {
  static let fixtureMealImage: UIImage? = {
    guard let url = Bundle.main.url(forResource: "fixture-meal", withExtension: "png") else {
      return nil
    }
    return UIImage(contentsOfFile: url.path)
  }()
}
