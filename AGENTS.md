# Native SwiftUI (pivoted 2026-09-13)

This is a native SwiftUI iOS app (deployment target iOS 18.0, Xcode 26.x / Swift 6 / iOS 26 SDK). Before writing any Swift code, check Axiom skills (axiom-swiftui, axiom-concurrency, axiom-data) and Apple SDK documentation for the exact APIs; gate iOS-26-only APIs with `#available(iOS 26.0, *)` and keep an iOS 18 fallback. The former Expo/React Native instruction (docs.expo.dev/versions/v57.0.0) is obsolete — the RN client was abandoned in the SwiftUI pivot.
