import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Native config for the RN app lives here and only here (single writer: the unit that holds the
 * native build slot). The identity is the production one: this app replaces the SwiftUI app, so the
 * bundle id, URL scheme and App Group must not change.
 */
const BUNDLE_ID = 'com.nextlabs.coachcal';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CoachCal',
  slug: 'coachcal',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'coachcal',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    icon: './assets/expo.icon',
    deploymentTarget: '18.0',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: `${BUNDLE_ID}`,
    adaptiveIcon: {
      backgroundColor: '#141210',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#141210',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-dev-client',
      {
        toolsButton: false,
        skipOnboarding: true,
        showMenuAtLaunch: false,
      },
    ],
    // Adds the HealthKit entitlement and the two usage strings (same strings as the SwiftUI app's Info.plist).
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'CoachCal reads your step count from Apple Health to show it on the Today screen and keep calorie estimates accurate.',
        NSHealthUpdateUsageDescription:
          'CoachCal saves burned-energy summaries to Apple Health only when you explicitly confirm them — never automatically from a scan.',
      },
    ],
    [
      'expo-widgets',
      {
        widgets: [
          {
            name: 'CaloriesWidget',
            displayName: 'CoachCal Calories',
            description: "Today's remaining kcal at a glance.",
            ios: {
              supportedFamilies: ['systemSmall'],
              initialLayout: 'src/widgets/CaloriesWidget.tsx',
            },
          },
        ],
      },
    ],
  ],
  updates: {
    enabled: false,
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
