import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Native config for the RN app lives here and only here (single writer: the unit that holds the
 * native build slot). The identity is the production one: this app replaces the SwiftUI app, so the
 * bundle id, URL scheme and App Group must not change.
 */
const BUNDLE_ID = 'com.nextlabs.coachcal';
const APP_GROUP = 'group.com.nextlabs.coachcal';

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
    deploymentTarget: '18.0',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // The SwiftUI app declares it; harmless until the Live Activity unit (U-43).
      NSSupportsLiveActivities: true,
    },
    // Same declarations as native/App/CoachCal/SupportingFiles/PrivacyInfo.xcprivacy. Expo merges them into the
    // generated PrivacyInfo.xcprivacy next to the required-reason API entries it adds itself.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeHealth',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          // The captured meal photo goes to the server for the calorie and macro analysis of the signed-in account.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
      ],
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
    // Camera string of the SwiftUI app's Info.plist. No microphone string: the old app never asked for one.
    [
      'expo-camera',
      {
        cameraPermission:
          'CoachCal uses the camera to photograph your meals so CoachCal can estimate calories and macros.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    // Adds the `com.apple.developer.applesignin` = [Default] entitlement.
    'expo-apple-authentication',
    // Defaults: adds `aps-environment` (development here; release builds are signed with the distribution profile).
    'expo-notifications',
    // UIBackgroundModes processing + BGTaskSchedulerPermittedIdentifiers (replaces the old BGTask triggers).
    'expo-background-task',
    // HealthKit (+ background delivery) and the App Group, unioned with what the plugins above add.
    './plugins/with-coachcal-entitlements',
    [
      'expo-widgets',
      {
        // Same group the SwiftUI widget used; the plugin writes it to the app and widget entitlements and
        // the app reads it through Info.plist `ExpoWidgetsAppGroupIdentifier`.
        groupIdentifier: APP_GROUP,
        // Extension id of the SwiftUI widget, kept so the provisioning profiles stay valid.
        bundleIdentifier: `${BUNDLE_ID}.CoachCalWidget`,
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
