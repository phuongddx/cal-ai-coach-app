/**
 * CCConfidenceBadge (Components/Content.swift). Visible AI confidence on every
 * scan. UI-SPEC lock: High ≥0.85, Medium ≥0.70, Low <0.70
 * (server TIER1_MIN_SCAN_CONFIDENCE = 0.7). ED-safe keeps the badge — AI
 * accuracy is not food morality.
 */

import { StyleSheet, Text, View } from 'react-native';

import { space, typography, useTokens, withAlpha, type Colors } from '../tokens';

export type ConfidenceTier = 'high' | 'medium' | 'low';

export type ConfidenceBadgeProps = {
  confidence: number;
  compact?: boolean;
};

// UI-SPEC lock: High ≥0.85, Medium ≥0.70, Low <0.70.
export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

export function confidenceLabel(tier: ConfidenceTier): string {
  switch (tier) {
    case 'high':
      return 'High — single item';
    case 'medium':
      return 'Medium — mixed dish';
    case 'low':
      return 'Low — review needed';
  }
}

function tierDotColor(colors: Colors, tier: ConfidenceTier): string {
  switch (tier) {
    case 'high':
      return colors.success;
    case 'medium':
      return colors.warning;
    case 'low':
      return colors.error;
  }
}

function tierTextColor(colors: Colors, tier: ConfidenceTier): string {
  switch (tier) {
    case 'high':
      return colors.successInk;
    case 'medium':
      return colors.warningInk;
    case 'low':
      return colors.errorInk;
  }
}

export function ConfidenceBadge({ confidence, compact = false }: ConfidenceBadgeProps) {
  const { colors } = useTokens();
  const tier = confidenceTier(confidence);
  const label = confidenceLabel(tier);
  const dotColor = tierDotColor(colors, tier);
  return (
    <View
      accessible
      accessibilityLabel={`Confidence ${label}`}
      testID={compact ? 'confidence-badge:compact' : 'confidence-badge'}
      style={[
        styles.badge,
        {
          backgroundColor: withAlpha(dotColor, 0.15),
          paddingVertical: compact ? 4 : 6,
          paddingHorizontal: compact ? 8 : 10,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text
        style={{
          fontSize: compact ? 10 : 12,
          fontWeight: '500',
          color: tierTextColor(colors, tier),
        }}
        numberOfLines={1}
        allowFontScaling
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
