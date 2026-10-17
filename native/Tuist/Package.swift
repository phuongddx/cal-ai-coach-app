// swift-tools-version: 6.0
import PackageDescription

#if TUIST
    import ProjectDescription

    let packageSettings = PackageSettings(
        productTypes: [
            "CoachCalCore": .staticFramework,
            "CoachCalDesignSystem": .staticFramework,
            "CoachCalPersistence": .staticFramework,
            "CoachCalNetworking": .staticFramework,
            "CoachCalSync": .staticFramework,
        ]
    )
#endif

let package = Package(
    name: "CoachCal",
    dependencies: [
        .package(path: "../Modules/CoachCalCore"),
        .package(path: "../Modules/CoachCalDesignSystem"),
        .package(path: "../Modules/CoachCalPersistence"),
        .package(path: "../Modules/CoachCalNetworking"),
        .package(path: "../Modules/CoachCalSync"),
        .package(url: "https://github.com/nalexn/ViewInspector", exact: "0.10.3"),
        .package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "1.19.4"),
        .package(url: "https://github.com/getsentry/sentry-cocoa", exact: "9.28.0"),
        .package(url: "https://github.com/PostHog/posthog-ios", exact: "3.75.2"),
    ]
)
