// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "CoachCalSync",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "CoachCalSync", targets: ["CoachCalSync"])
  ],
  dependencies: [
    .package(path: "../CoachCalCore"),
    .package(path: "../CoachCalPersistence"),
    .package(url: "https://github.com/groue/GRDB.swift.git", .exact(Version("7.11.1"))),
  ],
  targets: [
    .target(
      name: "CoachCalSync",
      dependencies: [
        "CoachCalCore",
        "CoachCalPersistence",
        .product(name: "GRDB", package: "GRDB.swift"),
      ]
    ),
    .testTarget(
      name: "CoachCalSyncTests",
      dependencies: [
        "CoachCalSync",
        "CoachCalCore",
        "CoachCalPersistence",
        .product(name: "GRDB", package: "GRDB.swift"),
      ]
    )
  ]
)
