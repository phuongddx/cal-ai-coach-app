import CoachCalCore
import CoachCalPersistence
import GRDB
import SnapshotTesting
import SwiftUI
import Testing
import UIKit

@testable import CoachCal
@testable import CoachCalDesignSystem

@MainActor
@Suite(.snapshots(record: .failed))
struct OnboardingSnapshotTests {
  private func makeRevealedModel() -> OnboardingModel {
    let model = OnboardingModel(userId: AppEnvironment.demoUserId)
    model.finishGenerationForTesting()
    return model
  }

  private func renderedImage(_ model: OnboardingModel, edSafe: Bool, dark: Bool) -> UIImage {
    let view = PlanRevealView(model: model)
      .environment(\.edSafeMode, edSafe)
      .environment(\.colorScheme, dark ? .dark : .light)
      .frame(width: 390, height: 844)
      .ccAnimationDisabled(true)

    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
    window.rootViewController = UIHostingController(rootView: view)
    window.overrideUserInterfaceStyle = dark ? .dark : .light
    window.makeKeyAndVisible()
    window.layoutIfNeeded()
    RunLoop.main.run(until: Date().addingTimeInterval(0.5))

    let renderer = UIGraphicsImageRenderer(size: window.bounds.size)
    let image = renderer.image { context in
      window.layer.render(in: context.cgContext)
    }
    window.isHidden = true
    return image
  }

  @Test func planRevealSnapshotMatrix() {
    let model = makeRevealedModel()

    assertSnapshot(
      of: renderedImage(model, edSafe: false, dark: false),
      as: .image,
      named: "plan-reveal-light"
    )
    assertSnapshot(
      of: renderedImage(model, edSafe: false, dark: true),
      as: .image,
      named: "plan-reveal-dark"
    )
    assertSnapshot(
      of: renderedImage(model, edSafe: true, dark: false),
      as: .image,
      named: "plan-reveal-edsafe-light"
    )
  }
}
