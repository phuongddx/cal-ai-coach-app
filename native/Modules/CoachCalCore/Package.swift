// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "CoachCalCore",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "CoachCalCore", targets: ["CoachCalCore"])
  ],
  targets: [
    .target(name: "CoachCalCore"),
    .testTarget(
      name: "CoachCalCoreTests",
      dependencies: ["CoachCalCore"]
    )
  ]
)
