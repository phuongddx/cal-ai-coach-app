/**
 * CCConfidenceBadge (Components/Content.swift). Visible AI confidence on every
 * scan. UI-SPEC lock: High ≥0.85, Medium ≥0.70, Low <0.70
 * (server TIER1_MIN_SCAN_CONFIDENCE = 0.7). ED-safe keeps the badge — AI
 * accuracy is not food morality.
 *
 * Ember (`#scan`, `#system` badge): the tier tint as fill, the tier ink as text, the tier
 * color as the dot, height 28 (22 compact), radius 14. It sits in its own full-width row and
 * its label is never truncated (no `numberOfLines`; a long label wraps instead).
 */

import { StyleSheet, Text, View } from 'react-native';

import { space, typography, useTokens, type Colors } from '../tokens';

export type ConfidenceTier = 'high' | 'medium' | 'low';

export type ConfidenceBadgeProps = {
  confidence: number;
  compact?: boolean;
  /**
   * `dish` (default) names a kind of dish ("High — single item"). `confidence` says the confidence
   * and nothing about the meal ("High confidence"), as the scan Review frames do.
   */
  copy?: 'dish' | 'confidence';
};

// UI-SPEC lock: High ≥0.85, Medium ≥0.70, Low <0.70.
export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

export function confidenceLabel(tier: ConfidenceTier, copy: 'dish' | 'confidence' = 'dish'): string {
  if (copy === 'confidence') {
    switch (tier) {
      case 'high':
        return 'High confidence';
      case 'medium':
        return 'Medium confidence';
      case 'low':
        return 'Low confidence';
    }
  }
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
      return colors.caution;
    case 'low':
      return colors.error;
  }
}

function tierTextColor(colors: Colors, tier: ConfidenceTier): string {
  switch (tier) {
    case 'high':
      return colors.successInk;
    case 'medium':
      return colors.cautionInk;
    case 'low':
      return colors.errorInk;
  }
}

function tierTintColor(colors: Colors, tier: ConfidenceTier): string {
  switch (tier) {
    case 'high':
      return colors.successTint;
    case 'medium':
      return colors.cautionTint;
    case 'low':
      return colors.errorTint;
  }
}

/** Badge height: canvas `.badge` is 28, the compact diary row variant is 22. */
export function confidenceBadgeHeight(compact: boolean): number {
  return compact ? 22 : 28;
}

export function ConfidenceBadge({ confidence, compact = false, copy = 'dish' }: ConfidenceBadgeProps) {
  const { colors } = useTokens();
  const tier = confidenceTier(confidence);
  const label = confidenceLabel(tier, copy);
  const height = confidenceBadgeHeight(compact);
  return (
    <View style={styles.row} testID={compact ? 'confidence-badge-row:compact' : 'confidence-badge-row'}>
      <View
        accessible
        accessibilityLabel={`Confidence ${label}`}
        testID={compact ? 'confidence-badge:compact' : 'confidence-badge'}
        style={[
          styles.badge,
          {
            backgroundColor: tierTintColor(colors, tier),
            minHeight: height,
            borderRadius: height / 2,
            paddingLeft: space[2],
            paddingRight: compact ? space[2] : space[3] - 2,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: tierDotColor(colors, tier) }]} />
        <Text
          style={{
            fontSize: compact ? typography.caption.fontSize : typography.footnote.fontSize,
            fontWeight: '600',
            color: tierTextColor(colors, tier),
            flexShrink: 1,
          }}
          allowFontScaling
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Its own full-width row: the badge never shares a line, so it never has to truncate.
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
  },
  badge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2] - 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
