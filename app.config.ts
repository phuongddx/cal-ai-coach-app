import type { ExpoConfig } from 'expo/config';

/**
 * Frozen native configuration surface (Phase 1, Plan 01-01 Task 3).
 *
 * This file is the single source of truth for the first development binary.
 * Plugin props, permission copy, entitlements, and the privacy manifest are
 * compiled into the binary — they cannot be changed via OTA. Treat every edit
 * here as a new-binary event (runtimeVersion policy: fingerprint).
 *
 * SECRETS POLICY: never add service-role keys, AI keys, or any server
 * credential to this file. Client-facing values live in EXPO_PUBLIC_* env vars
 * validated by src/lib/env.ts.
 *
 * Notes:
 * - SDK 57 removed the typed `newArchEnabled` property — New Architecture is
 *   the mandatory default on React Native 0.86; nothing to opt into.
 * - Splash configuration lives in the expo-splash-screen plugin (SDK 57).
 * - HealthKit: @kingstinct/react-native-healthkit plugin — approved fallback
 *   after react-native-health@1.19.0 failed to compile against RN 0.86.
 */

const config: ExpoConfig = {
  name: 'CoachCal',
  slug: 'coachcal',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: 'coachcal',
  ios: {
    bundleIdentifier: 'com.nextlabs.coachcal',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription:
        'CoachCal uses the camera to scan food labels and barcodes so your meals can be logged automatically.',
      NSMicrophoneUsageDescription:
        'CoachCal does not record audio. Microphone access is never requested in this build.',
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
  },
  android: {
    package: 'com.nextlabs.coachcal',
    adaptiveIcon: {
      backgroundColor: '#141416',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-secure-store',
    [
      'expo-camera',
      {
        // CLAUDE.md invariant: must be set in app.config before the first native build.
        barcodeScannerEnabled: true,
        recordAudioAndroid: false,
        cameraPermission:
          'CoachCal uses the camera to scan food labels and barcodes so your meals can be logged automatically.',
        microphonePermission:
          'CoachCal does not record audio. Microphone access is never requested in this build.',
      },
    ],
    [
      '@kingstinct/react-native-healthkit',
      {
        // Least privilege: no background delivery in Phase 1.
        background: false,
        NSHealthShareUsageDescription:
          'CoachCal reads your steps and energy data to give you more accurate daily insights. You control what is shared.',
        NSHealthUpdateUsageDescription:
          'CoachCal saves logged meals and nutrition to Apple Health when you ask it to. You control what is saved.',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#141416',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Public, non-secret values only. Secrets are injected via EAS env vars
    // and validated at runtime by src/lib/env.ts.
  },
};

export default config;
