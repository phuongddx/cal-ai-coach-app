import ProjectDescription

// project.yml's root-level `settings.base` applied SWIFT_VERSION,
// actor-isolation, concurrency, and signing-team/identity to EVERY target
// (app, widget, tests, UI tests) by XcodeGen's default inheritance. Tuist's
// `Project(settings:)` is the equivalent project-wide default — do not put
// these only on the app target, or the widget/test targets silently regress
// to Swift 5 language mode and lose actor isolation.
let projectBaseSettings: SettingsDictionary = [
    "SWIFT_VERSION": "6.0",
    "SWIFT_DEFAULT_ACTOR_ISOLATION": "MainActor",
    "SWIFT_APPROACHABLE_CONCURRENCY": "YES",
    "CODE_SIGN_STYLE": "Manual",
    "DEVELOPMENT_TEAM": "K2TYLYAWMK",
    "CODE_SIGN_IDENTITY": "iPhone Distribution: Doan Duy Phuong (K2TYLYAWMK)",
]

// App-target-only additions from project.yml's `targets.CoachCal.settings.base`.
let appSettings: SettingsDictionary = [
    "PRODUCT_BUNDLE_IDENTIFIER": "com.nextlabs.coachcal",
    "TARGETED_DEVICE_FAMILY": "1",
    "PROVISIONING_PROFILE_SPECIFIER": "CoachCal AppStore",
    // Tuist's default (.recommended) target settings inject their own
    // CODE_SIGN_IDENTITY ("iPhone Developer") at TARGET scope, which wins
    // over the project-level Distribution identity in projectBaseSettings
    // (target settings always win over project settings for the same key
    // in a generated Xcode project). Re-declaring it explicitly here is
    // required to actually preserve Manual/Distribution signing, not
    // redundant. Task 2 review (round 1) caught this as a Critical finding.
    "CODE_SIGN_IDENTITY": "iPhone Distribution: Doan Duy Phuong (K2TYLYAWMK)",
    "SUPABASE_URL": "$(COACHCAL_SUPABASE_URL:http://127.0.0.1:54321)",
    "SUPABASE_ANON_KEY": "$(COACHCAL_SUPABASE_ANON_KEY)",
    "SENTRY_DSN": "$(COACHCAL_SENTRY_DSN:)",
    "POSTHOG_API_KEY": "$(COACHCAL_POSTHOG_API_KEY:)",
]

let coachCalTarget = Target.target(
    name: "CoachCal",
    destinations: .iOS,
    product: .app,
    bundleId: "com.nextlabs.coachcal",
    deploymentTargets: .iOS("18.0"),
    infoPlist: .extendingDefault(with: [
        "CFBundleURLTypes": [
            [
                "CFBundleURLName": "com.nextlabs.coachcal",
                "CFBundleURLSchemes": ["coachcal"],
            ],
        ],
        "SUPABASE_URL": "$(SUPABASE_URL)",
        "SUPABASE_ANON_KEY": "$(SUPABASE_ANON_KEY)",
        "SENTRY_DSN": "$(SENTRY_DSN)",
        "POSTHOG_API_KEY": "$(POSTHOG_API_KEY)",
        "CFBundleDisplayName": "CoachCal",
        "NSCameraUsageDescription": "CoachCal uses the camera to photograph your meals so CoachCal can estimate calories and macros.",
        "ITSAppUsesNonExemptEncryption": false,
        "NSHealthShareUsageDescription": "CoachCal reads your step count from Apple Health to show it on the Today screen and keep calorie estimates accurate.",
        "NSHealthUpdateUsageDescription": "CoachCal saves burned-energy summaries to Apple Health only when you explicitly confirm them — never automatically from a scan.",
        "NSSupportsLiveActivities": true,
    ]),
    sources: [
        "App/CoachCal/**",
        "App/Features/**",
    ],
    resources: [
        "App/CoachCal/Assets.xcassets",
        "App/CoachCal/Resources/**",
        // Tuist's `sources:` glob only matches compilable source
        // extensions, unlike XcodeGen's folder-based `App/CoachCal` source
        // which implicitly bucketed every non-source file (including this
        // one) as a resource. Without this explicit entry the privacy
        // manifest is silently dropped from the app bundle (App Store
        // submission blocker). Task 2 review (round 1) caught this as a
        // Critical finding.
        "App/CoachCal/SupportingFiles/PrivacyInfo.xcprivacy",
    ],
    entitlements: .file(path: "App/CoachCal/SupportingFiles/CoachCal.entitlements"),
    dependencies: [
        .external(name: "CoachCalCore"),
        .external(name: "CoachCalDesignSystem"),
        .external(name: "CoachCalPersistence"),
        .external(name: "CoachCalNetworking"),
        .external(name: "CoachCalSync"),
        .external(name: "Sentry"),
        .external(name: "PostHog"),
        .target(name: "CoachCalWidget"),
    ],
    settings: .settings(base: appSettings)
)

let coachCalWidgetTarget = Target.target(
    name: "CoachCalWidget",
    destinations: .iOS,
    product: .appExtension,
    bundleId: "com.nextlabs.coachcal.CoachCalWidget",
    deploymentTargets: .iOS("18.0"),
    infoPlist: .extendingDefault(with: [
        "CFBundleDisplayName": "CoachCal Widget",
        "NSExtension": [
            "NSExtensionPointIdentifier": "com.apple.widgetkit-extension",
        ],
    ]),
    sources: [
        "CoachCalWidget/**",
        "App/Features/LiveActivity/CoachCalLiveActivityAttributes.swift",
    ],
    entitlements: .file(path: "CoachCalWidget/CoachCalWidget.entitlements"),
    dependencies: [
        .external(name: "CoachCalDesignSystem"),
        .external(name: "CoachCalCore"),
    ],
    settings: .settings(base: [
        "PRODUCT_BUNDLE_IDENTIFIER": "com.nextlabs.coachcal.CoachCalWidget",
        "TARGETED_DEVICE_FAMILY": "1",
        // Same fix as appSettings above: Tuist's default target settings
        // override the project-level Distribution identity per-target.
        "CODE_SIGN_IDENTITY": "iPhone Distribution: Doan Duy Phuong (K2TYLYAWMK)",
    ])
)

let project = Project(
    name: "CoachCal",
    settings: .settings(base: projectBaseSettings),
    targets: [
        coachCalTarget,
        coachCalWidgetTarget,
    ]
)
