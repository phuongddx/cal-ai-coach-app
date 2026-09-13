// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "CoachCalPersistence",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "CoachCalPersistence", targets: ["CoachCalPersistence"])
  ],
  dependencies: [
    .package(path: "../CoachCalCore"),
    .package(
      url: "https://github.com/groue/GRDB.swift.git",
      .exact(Version("7.11.1"))
    )
  ],
  targets: [
    .target(
      name: "CoachCalPersistence",
      dependencies: [
        "CoachCalCore",
        .product(name: "GRDB", package: "GRDB.swift"),
      ]
    )
  ]
)
