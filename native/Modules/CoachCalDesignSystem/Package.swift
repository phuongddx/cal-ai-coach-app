// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "CoachCalDesignSystem",
  platforms: [.iOS(.v18)],
  products: [
    .library(name: "CoachCalDesignSystem", targets: ["CoachCalDesignSystem"])
  ],
  dependencies: [
    .package(path: "../CoachCalCore")
  ],
  targets: [
    .target(
      name: "CoachCalDesignSystem",
      dependencies: ["CoachCalCore"],
      resources: [
        .process("Colors.xcassets")
      ]
    ),
    .testTarget(
      name: "CoachCalDesignSystemTests",
      dependencies: ["CoachCalDesignSystem"]
    )
  ]
)
