import Constants from 'expo-constants';
import type * as SentryTypes from '@sentry/react-native';
import type PostHogClient from 'posthog-react-native';

/**
 * Phase 1 telemetry bootstrap (roadmap scope: initialize from commit one).
 * No product analytics events are created in Phase 1 — boot/build visibility only.
 * DSNs/keys arrive via EXPO_PUBLIC_* vars; absent values degrade to a no-op so
 * local/test runs never crash on missing telemetry configuration.
 */

let initialized = false;
let posthog: PostHogClient | null = null;

export function initializeTelemetry(): void {
  if (initialized) return;
  initialized = true;

  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (sentryDsn) {
    // Lazy require keeps Sentry out of the critical path when unconfigured.
    const Sentry = require('@sentry/react-native') as typeof SentryTypes;
    Sentry.init({
      dsn: sentryDsn,
      environment:
        process.env.EXPO_PUBLIC_ENVIRONMENT ??
        (__DEV__ ? 'development' : 'production'),
    });
  }

  const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    const { default: PostHog } = require('posthog-react-native') as {
      default: new (
        apiKey: string,
        options: { host: string }
      ) => PostHogClient;
    };
    posthog = new PostHog(posthogKey, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    });
  }
}

export function getPostHog(): PostHogClient | null {
  return posthog;
}
