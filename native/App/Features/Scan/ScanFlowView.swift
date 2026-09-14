import CoachCalDesignSystem
import CoachCalNetworking
import SwiftUI

// Thin routed slice — 03-05 replaces this file's contents with the full scan flow.
// The seam (route init + api call + shutter) is real now; the visual shell is not final.
struct ScanFlowView: View {
  @Environment(AppEnvironment.self) private var environment
  @Environment(\.dismiss) private var dismiss

  let route: ScanRoute

  @State private var resultText: String?
  @State private var isAnalyzing = false

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: CCSpace.xl) {
        HStack {
          Button {
            dismiss()
          } label: {
            Image(systemName: "xmark")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(Color.white)
              .frame(width: CCSize.tapTarget, height: CCSize.tapTarget)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Close scanner")
          Spacer()
        }

        modePills

        Spacer()

        shutterButton
          .accessibilityIdentifier("scan.shutter")

        if let resultText {
          Text(resultText)
            .ccFont(.subhead)
            .foregroundStyle(Color.white)
            .accessibilityIdentifier("scan.result")
        }

        if let mealSlot = route.mealSlot {
          Text("Logging to \(mealSlot.rawValue.capitalized)")
            .ccFont(.footnote)
            .foregroundStyle(Color.white.opacity(0.7))
        }
      }
      .padding(CCSpace.xl2)
    }
  }

  private var modePills: some View {
    HStack(spacing: CCSpace.sm) {
      modePill("Scan Food", mode: .photo)
      modePill("Barcode", mode: .barcode)
      modePill("Label", mode: .label)
    }
  }

  private func modePill(_ title: String, mode: ScanMode) -> some View {
    Text(title)
      .ccFont(.subhead)
      .foregroundStyle(route.mode == mode ? Color.black : Color.white)
      .padding(.vertical, CCSpace.sm)
      .padding(.horizontal, CCSpace.lg)
      .background(route.mode == mode ? Color.ccAccentLime : Color.white.opacity(0.15))
      .clipShape(Capsule())
  }

  private var shutterButton: some View {
    Button {
      Task { await analyze() }
    } label: {
      Circle()
        .fill(Color.ccAccentLime)
        .frame(width: CCSize.shutter, height: CCSize.shutter)
        .overlay(
          Circle()
            .strokeBorder(Color.white.opacity(0.3), lineWidth: 4)
        )
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .disabled(isAnalyzing)
    .accessibilityLabel("Capture photo, button")
  }

  private func analyze() async {
    isAnalyzing = true
    defer { isAnalyzing = false }
    let kind = ScanRequest.Kind(rawValue: route.mode.rawValue) ?? .photo
    let request = ScanRequest(kind: kind)
    do {
      let response = try await environment.api.analyzeFood(request)
      resultText = "\(response.items.count) items found"
    } catch let error as ScanAPIError {
      if case .envelope(let code, _, _) = error {
        resultText = "Error: \(code)"
      } else {
        resultText = "Error: analysis failed"
      }
    } catch {
      resultText = "Error: analysis failed"
    }
  }
}
