import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Native config for all four spike items lives here and only here (single writer: the spike owner).
 * Bundle id is deliberately NOT the production one (com.nextlabs.coachcal): a spike build must never
 * collide with the App Store app, its App Group or its HealthKit source.
 */
const BUNDLE_ID = 'com.nextlabs.coachcal.rnspike';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CoachCal Spike',
  slug: 'coachcal-rn-spike',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ccspike',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    icon: './assets/expo.icon',
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
    // Adds the HealthKit entitlement and the two usage strings (spike item 3).
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'CoachCal Spike reads back the meals it wrote to Health so the round trip can be verified.',
        NSHealthUpdateUsageDescription:
          'CoachCal Spike writes the meal you log so the round trip can be verified.',
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
              supportedFamilies: ['systemSmall', 'systemMedium'],
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
