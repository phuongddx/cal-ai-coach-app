import CoachCalDesignSystem
import SwiftUI

// Fix Issue correction capture (LOG-06): pick an issue kind + optional note
// against one scan item. Phase 3 records the correction on the review item —
// uploading it into the improve-future-scans learning loop is a Phase 4
// obligation.
struct CorrectionCaptureView: View {
  let model: ScanModel
  let itemId: Int
  let onDismiss: () -> Void

  @State private var kind: ScanModel.Correction.Kind = .wrongFood
  @State private var note = ""

  private var item: ScanModel.ResultItem? {
    model.result?.items.first { $0.id == itemId }
  }

  var body: some View {
    CCSheet {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text("Fix Issue")
              .ccFont(.heading)
              .foregroundStyle(Color.ccTextPrimary)
            if let item {
              Text(item.source.label)
                .ccFont(.footnote)
                .foregroundStyle(Color.ccTextSecondary)
                .lineLimit(1)
            }
          }
          Spacer()
          Button(action: onDismiss) {
            Image(systemName: "xmark")
              .font(.system(size: 14, weight: .semibold))
              .foregroundStyle(Color.ccTextSecondary)
              .frame(width: 44, height: 44)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Close")
          .accessibilityIdentifier("scan.correction.close")
        }

        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: CCSpace.sm) {
          ForEach(ScanModel.Correction.Kind.allCases, id: \.self) { candidate in
            Button {
              kind = candidate
            } label: {
              CCChipOption(title: candidate.title, isSelected: kind == candidate)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scan.correction.kind.\(candidate.rawValue)")
          }
        }

        TextField("Add a note (optional)", text: $note)
          .ccFont(.body)
          .padding(CCSpace.md)
          .background(Color.ccCard)
          .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
          .accessibilityIdentifier("scan.correction.note")

        CCPrimaryButton("Save note") {
          model.captureCorrection(kind: kind, note: note, for: itemId)
          onDismiss()
        }
        .accessibilityIdentifier("scan.correction.save")
      }
    }
  }
}
