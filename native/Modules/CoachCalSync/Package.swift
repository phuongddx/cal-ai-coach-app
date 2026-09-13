// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "CoachCalSync",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "CoachCalSync", targets: ["CoachCalSync"])
  ],
  dependencies: [
    .package(path: "../CoachCalCore")
  ],
  targets: [
    .target(
      name: "CoachCalSync",
      dependencies: ["CoachCalCore"]
    )
  ]
)
