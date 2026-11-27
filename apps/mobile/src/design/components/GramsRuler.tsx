/**
 * The drag ruler of the Ember review frame (`#scan` frame 03): ticks every 10 units (10 pt apart,
 * 1 pt per unit), a taller major tick every `majorEvery` units (50), a 3 pt `accentStrong` needle in the
 * middle and the labels of the major ticks around the current value, which is bold in `accentInk`.
 * The ruler slides under the needle: dragging right lowers the value, as the canvas's scrolling ruler.
 *
 * `onChange` gets whole units, snapped to `step` and clamped to `min`..`max`. VoiceOver changes the
 * value without a drag through the `increment` / `decrement` accessibility actions (by `step`).
 * The drag uses the responder system (like `PaceSlider`), not gesture-handler, so Jest drives it
 * with `responderGrant` / `responderMove`.
 *
 * Tick fade at the two edges is an opacity ramp (there is no mask in React Native).
 */

import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { space, useTokens } from '../tokens';

export type GramsRulerProps = {
  value: number;
  /** Whole units. */
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  majorEvery?: number;
  accessibilityLabel: string;
  testID: string;
};

/** Points per unit and per minor tick: 10 units are 10 pt, a 50-unit major tick is 50 pt. */
export const rulerPointsPerUnit = 1;
export const rulerMinorEvery = 10;
export const rulerHeight = 36;

/** Snap to the step grid (anchored at `min`) and clamp. */
export function snapRulerValue(raw: number, min: number, max: number, step: number): number {
  const safeStep = step > 0 ? step : 1;
  const snapped = min + Math.round((raw - min) / safeStep) * safeStep;
  return Math.min(Math.max(snapped, min), max);
}

/** The value after a horizontal drag of `dx` points that started at `startValue`. */
export function rulerValueAfterDrag(
  startValue: number,
  dx: number,
  min: number,
  max: number,
  step: number,
): number {
  return snapRulerValue(startValue - dx / rulerPointsPerUnit, min, max, step);
}

/** Opacity of a tick at `distance` points from the needle on a ruler `width` wide (fades over 20%). */
export function rulerTickOpacity(distance: number, width: number): number {
  const half = width / 2;
  if (half <= 0) return 1;
  const fadeStart = half * 0.6;
  const d = Math.abs(distance);
  if (d <= fadeStart) return 1;
  return Math.max(0, 1 - (d - fadeStart) / (half - fadeStart));
}

type Tick = { unit: number; x: number; major: boolean; opacity: number };

/** The ticks visible on a ruler `width` wide centred on `value`. */
export function rulerTicks(value: number, width: number, majorEvery: number): Tick[] {
  const half = width / 2;
  const first = Math.ceil((value - half / rulerPointsPerUnit) / rulerMinorEvery) * rulerMinorEvery;
  const ticks: Tick[] = [];
  for (let unit = first; (unit - value) * rulerPointsPerUnit <= half; unit += rulerMinorEvery) {
    const distance = (unit - value) * rulerPointsPerUnit;
    ticks.push({
      unit,
      x: half + distance,
      major: majorEvery > 0 && unit % majorEvery === 0,
      opacity: rulerTickOpacity(distance, width),
    });
  }
  return ticks;
}

export function GramsRuler({
  value,
  onChange,
  min,
  max,
  step = 1,
  majorEvery = 50,
  accessibilityLabel,
  testID,
}: GramsRulerProps) {
  const { colors } = useTokens();
  const [width, setWidth] = useState(0);
  const drag = useRef({ x: 0, value });

  const current = Math.min(Math.max(value, min), max);
  const ticks = width > 0 ? rulerTicks(current, width, majorEvery) : [];

  const moveTo = (next: number) => {
    if (next !== current) onChange(next);
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: current, text: String(current) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
        moveTo(snapRulerValue(current + delta, min, max, step));
      }}
      testID={testID}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event: GestureResponderEvent) => {
        drag.current = { x: event.nativeEvent.pageX, value: current };
      }}
      onResponderMove={(event: GestureResponderEvent) => {
        const dx = event.nativeEvent.pageX - drag.current.x;
        moveTo(rulerValueAfterDrag(drag.current.value, dx, min, max, step));
      }}
      style={styles.ruler}
    >
      {width > 0 && (
        <Svg width={width} height={rulerHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
          {ticks.map((tick) => (
            <Line
              key={tick.unit}
              testID={`${testID}.tick.${tick.unit}`}
              x1={tick.x}
              x2={tick.x}
              y1={tick.major ? 2 : 6}
              y2={tick.major ? 24 : 20}
              stroke={tick.major ? colors.text2 : colors.text3}
              strokeOpacity={tick.major ? tick.opacity : tick.opacity * 0.6}
              strokeWidth={tick.major ? 2 : 1}
            />
          ))}
        </Svg>
      )}
      <View
        pointerEvents="none"
        testID={`${testID}.needle`}
        style={[styles.needle, { backgroundColor: colors.accentStrong, left: width / 2 - 1 }]}
      />
      <View pointerEvents="none" style={styles.labels}>
        {ticks
          .filter((tick) => tick.major && Math.abs(tick.unit - current) * rulerPointsPerUnit > 18)
          .map((tick) => (
            <Text
              key={tick.unit}
              importantForAccessibility="no"
              style={[styles.label, { left: tick.x - 20, color: colors.text2, opacity: tick.opacity }]}
            >
              {tick.unit}
            </Text>
          ))}
        <Text
          testID={`${testID}.value`}
          importantForAccessibility="no"
          style={[styles.label, styles.valueLabel, { left: width / 2 - 20, color: colors.accentInk }]}
        >
          {current}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ruler: {
    height: rulerHeight + space.md,
    overflow: 'hidden',
  },
  needle: {
    position: 'absolute',
    top: 0,
    width: 3,
    height: 28,
    borderRadius: 2,
  },
  labels: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: space.lg,
  },
  label: {
    position: 'absolute',
    width: 40,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  valueLabel: {
    fontWeight: '700',
  },
});
