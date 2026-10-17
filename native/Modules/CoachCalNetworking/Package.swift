// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "CoachCalNetworking",
  platforms: [.iOS(.v18), .macOS(.v15)],
  products: [
    .library(name: "CoachCalNetworking", targets: ["CoachCalNetworking"])
  ],
  dependencies: [
    .package(path: "../CoachCalCore"),
    .package(path: "../CoachCalPersistence"),
    .package(path: "../CoachCalSync"),
    .package(
      url: "https://github.com/supabase/supabase-swift.git",
      .exact(Version("2.55.2"))
    )
  ],
  targets: [
    .target(
      name: "CoachCalNetworking",
      dependencies: [
        "CoachCalCore",
        .product(name: "Supabase", package: "supabase-swift"),
      ]
    ),
    .testTarget(
      name: "CoachCalNetworkingTests",
      dependencies: ["CoachCalNetworking", "CoachCalPersistence", "CoachCalSync"],
      resources: [.copy("Fixtures")]
    )
  ]
)
