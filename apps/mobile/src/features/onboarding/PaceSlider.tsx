/**
 * The RN counterpart of the SwiftUI `Slider` in GoalWeightPaceView (0…1.5,
 * step 0.05). The worktree's dependency set has no community slider package,
 * so this is a small core-RN control: a responder-driven track (real usage)
 * plus `adjustable` accessibility actions (increment/decrement), which is how
 * assistive tech drives a slider anyway. Engine-owned clamping stays in the
 * model: every change lands on `model.setPace`, so an unsafe value snaps back.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTokens } from '../../design';

export type PaceSliderProps = {
  /** The current value in kg/week. */
  value: number;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  onValueChange: (value: number) => void;
  testID?: string;
  /** The accessibilityValue text (Swift `.accessibilityValue`). */
  accessibilityValueText?: string;
};

const TRACK_HEIGHT = 4;
const KNOB_SIZE = 24;

function roundToStep(value: number, step: number, minimum: number): number {
  const steps = Math.round((value - minimum) / step);
  return minimum + steps * step;
}

export function PaceSlider({
  value,
  minimumValue = 0,
  maximumValue = 1.5,
  step = 0.05,
  onValueChange,
  testID,
  accessibilityValueText,
}: PaceSliderProps) {
  const { colors } = useTokens();
  const [trackWidth, setTrackWidth] = useState(0);
  const span = maximumValue - minimumValue;
  const fraction = span > 0 ? Math.min(Math.max((value - minimumValue) / span, 0), 1) : 0;

  const clamp = (candidate: number): number =>
    Math.min(Math.max(roundToStep(candidate, step, minimumValue), minimumValue), maximumValue);

  const valueAt = (locationX: number): number => {
    if (trackWidth <= 0) return value;
    const touched = Math.min(Math.max(locationX / trackWidth, 0), 1);
    return clamp(minimumValue + touched * span);
  };

  return (
    <View
      testID={testID}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: accessibilityValueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
        onValueChange(clamp(value + delta));
      }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => trackWidth > 0}
      onMoveShouldSetResponder={() => trackWidth > 0}
      onResponderGrant={(event) => onValueChange(valueAt(event.nativeEvent.locationX))}
      onResponderMove={(event) => onValueChange(valueAt(event.nativeEvent.locationX))}
      style={styles.trackWrap}
    >
      <View style={[styles.rail, { backgroundColor: colors.surface, borderRadius: radius.sm }]} />
      <View
        style={[
          styles.fill,
          { backgroundColor: colors.accentLime, width: `${fraction * 100}%`, borderRadius: radius.sm },
        ]}
      />
      <View
        style={[
          styles.knob,
          { left: `${fraction * 100}%`, backgroundColor: colors.accentInk, borderRadius: radius.full },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  trackWrap: {
    height: KNOB_SIZE + space.sm,
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
  },
  knob: {
    position: 'absolute',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    marginLeft: -KNOB_SIZE / 2,
  },
});
