/**
 * The Ember weight chart (frame 11): the accent area fill at 10% under an
 * `accentStrong` 3 pt line, an integer-kg y-axis that fits the windowed data
 * with its labels, the end dot and the first/last date labels. Drawn here
 * because the design-system ChartCard has no area fill, axis labels or
 * window summary yet — the gap is recorded in findings U-75 under
 * "Needs a design component". The `chart-card` identifier stays on the root,
 * and the accessibility label is weightTrendA11yLabel's frame sentence with
 * the real numbers.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { typography, useTokens, withAlpha } from '../../../design';

import { dateFromDay } from '../progressMath';
import { weightTrendA11yLabel, weightYRange } from '../weightChartDescriptor';
import type { ChartPoint } from '../../../design';

export type WeightChartProps = {
  points: ChartPoint[];
  /** The range window's length in days, as the summary sentence reads it. */
  windowDays: number;
};

const CHART_HEIGHT = 150;
const PAD_Y = 10;
const AXIS_WIDTH = 30;

/** The integer-kg gridlines of the axis that fits the data (frame: 83/82/81). */
export function weightAxisTicks(minimum: number, maximum: number): number[] {
  const first = Math.ceil(minimum - 1e-9);
  const last = Math.ceil(maximum - 1e-9);
  const ticks: number[] = [];
  for (let tick = first; tick <= last; tick += 1) {
    ticks.push(tick);
  }
  return ticks.length > 0 ? ticks : [Math.round((minimum + maximum) / 2)];
}

/** The x label under the chart's first and last point ("27 Oct"). */
export function chartDayLabel(day: string): string {
  const date = dateFromDay(day);
  if (date === null) {
    return day;
  }
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(date);
}

export function WeightChart({ points, windowDays }: WeightChartProps) {
  const { colors } = useTokens();
  const [width, setWidth] = useState(0);

  const range = weightYRange(points);
  const span = range.maximum - range.minimum || 1;
  const last = points.length - 1;
  const plotWidth = Math.max(width - AXIS_WIDTH, 0);
  const xs = points.map(
    (_, index) => (plotWidth * index) / (points.length - 1),
  );
  const ys = points.map((point) => {
    const normalized = (point.value - range.minimum) / span;
    return CHART_HEIGHT - PAD_Y - normalized * (CHART_HEIGHT - 2 * PAD_Y);
  });
  const ticks = weightAxisTicks(range.minimum, range.maximum);
  const tickYs = ticks.map((tick) => {
    const normalized = (tick - range.minimum) / span;
    return CHART_HEIGHT - PAD_Y - normalized * (CHART_HEIGHT - 2 * PAD_Y);
  });
  const areaPath =
    points.length > 1
      ? `M ${xs[0]} ${ys[0]} ${points
          .slice(1)
          .map((_, index) => `L ${xs[index + 1]} ${ys[index + 1]}`)
          .join(' ')} L ${xs[last]} ${CHART_HEIGHT - PAD_Y} L ${xs[0]} ${CHART_HEIGHT - PAD_Y} Z`
      : '';

  return (
    <View
      testID="chart-card"
      accessible
      accessibilityLabel={weightTrendA11yLabel(points, windowDays)}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && points.length > 1 && (
        <Svg width={width} height={CHART_HEIGHT}>
          <Path d={areaPath} fill={withAlpha(colors.accent, 0.1)} />
          {/* The integer-kg axis that fits the data, labels on the right. */}
          {ticks.map((tick, index) => (
            <Line
              key={tick}
              x1={0}
              y1={tickYs[index] ?? 0}
              x2={plotWidth}
              y2={tickYs[index] ?? 0}
              stroke={colors.separator}
              strokeWidth={1}
            />
          ))}
          {ticks.map((tick, index) => (
            <SvgText
              key={`label-${tick}`}
              x={width}
              y={(tickYs[index] ?? 0) + 4}
              textAnchor="end"
              fill={colors.text2}
              fontSize={12}
            >
              {tick}
            </SvgText>
          ))}
          {/* The trend line and its end dot in accentStrong. */}
          <Line
            x1={xs[0] ?? 0}
            y1={ys[0] ?? 0}
            x2={xs[last] ?? 0}
            y2={ys[last] ?? 0}
            stroke={colors.accentStrong}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx={xs[last] ?? 0}
            cy={ys[last] ?? 0}
            r={5}
            fill={colors.accentStrong}
          />
        </Svg>
      )}
      <View style={styles.dateRow}>
        <Text style={[typography.caption, styles.dateLabel, { color: colors.text2 }]}>
          {points.length > 0 ? chartDayLabel(points[0]?.label ?? '') : ''}
        </Text>
        <Text style={[typography.caption, styles.dateLabel, { color: colors.text2 }]}>
          {points.length > 0 ? chartDayLabel(points[last]?.label ?? '') : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingRight: AXIS_WIDTH,
  },
  dateLabel: {
    fontVariant: ['tabular-nums'],
  },
});
