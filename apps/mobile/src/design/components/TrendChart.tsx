/**
 * TrendChart: the weight trend of the Progress frame (frame 11) as one component. An accent area fill at
 * 10% under a 3 pt `accentStrong` line, a vertical axis that fits the data with its labels on the right,
 * date labels along the bottom and the end dot. Drawn with react-native-svg; the labels are plain Text so
 * they scale and test like text. The accessibility label comes from the caller, which alone knows the
 * numbers ("Weight, down 1.2 kg over 30 days"); the chart itself is one image element.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { space, typography, useTokens, withAlpha } from '../tokens';

export type TrendPoint = {
  /** When the value was taken: a `Date`, epoch milliseconds, or a day string (`2026-10-27` or ISO). */
  at: Date | number | string;
  value: number;
};

export type TrendChartProps = {
  points: TrendPoint[];
  /** Unit written after the top axis label (`kg`, `lb`). */
  unit: string;
  accessibilityLabel: string;
  testID?: string;
};

export const trendChartHeight = 150;
const PAD_Y = 10;
const AXIS_WIDTH = 40;
const MAX_DATE_LABELS = 4;
const LINE_WIDTH = 3;
const DOT_RADIUS = 5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Epoch milliseconds of a point's `at`; a bare `YYYY-MM-DD` is read as a local day. NaN if unreadable. */
export function trendTime(at: TrendPoint['at']): number {
  if (at instanceof Date) return at.getTime();
  if (typeof at === 'number') return at;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(at);
  if (day != null) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime();
  return Date.parse(at);
}

/** "27 Oct". */
export function trendDateLabel(at: TrendPoint['at']): string {
  const time = trendTime(at);
  if (Number.isNaN(time)) return typeof at === 'string' ? at : '';
  const date = new Date(time);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function niceStep(raw: number): number {
  const exponent = Math.floor(Math.log10(raw));
  const base = 10 ** exponent;
  const fraction = raw / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

export type TrendAxis = { min: number; max: number; step: number; ticks: number[] };

/** A vertical axis with round tick values that contains every value; a flat series gets a symmetric span. */
export function trendAxis(values: number[]): TrendAxis {
  if (values.length === 0) return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (high - low < 1e-9) {
    low -= 1;
    high += 1;
  }
  const step = niceStep((high - low) / 3);
  const min = Math.floor(low / step + 1e-9) * step;
  const max = Math.ceil(high / step - 1e-9) * step;
  const ticks: number[] = [];
  const count = Math.round((max - min) / step);
  for (let index = 0; index <= count; index += 1) {
    ticks.push(Math.round((min + index * step) * 1e6) / 1e6);
  }
  return { min, max, step, ticks };
}

export function trendTickLabel(tick: number, step: number): string {
  return step < 1 ? tick.toFixed(1) : `${tick}`;
}

/** Indexes of the points whose dates are written under the chart: first, last and evenly between. */
export function trendDateLabelIndexes(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const labels = Math.min(MAX_DATE_LABELS, count);
  const picked = new Set<number>();
  for (let index = 0; index < labels; index += 1) {
    picked.add(Math.round((index * (count - 1)) / (labels - 1)));
  }
  return [...picked].sort((a, b) => a - b);
}

export function TrendChart({ points, unit, accessibilityLabel, testID = 'trend-chart' }: TrendChartProps) {
  const { colors } = useTokens();
  const [width, setWidth] = useState(0);

  const axis = trendAxis(points.map((point) => point.value));
  const span = axis.max - axis.min || 1;
  const plotWidth = Math.max(width - AXIS_WIDTH, 0);
  const plotHeight = trendChartHeight - 2 * PAD_Y;
  const yOf = (value: number) => PAD_Y + plotHeight - ((value - axis.min) / span) * plotHeight;

  const times = points.map((point) => trendTime(point.at));
  const timed = times.every((time) => !Number.isNaN(time)) && times.length > 1 && times[0] !== times[times.length - 1];
  const first = times[0] ?? 0;
  const lastTime = times[times.length - 1] ?? 0;
  const xOf = (index: number) => {
    if (points.length <= 1) return plotWidth;
    const fraction = timed ? ((times[index] ?? first) - first) / (lastTime - first) : index / (points.length - 1);
    return fraction * plotWidth;
  };

  const xs = points.map((_, index) => xOf(index));
  const ys = points.map((point) => yOf(point.value));
  const lastIndex = points.length - 1;
  const linePath = points.length > 1 ? xs.map((x, index) => `${index === 0 ? 'M' : 'L'} ${x} ${ys[index]}`).join(' ') : '';
  const areaPath =
    points.length > 1
      ? `${linePath} L ${xs[lastIndex]} ${trendChartHeight - PAD_Y} L ${xs[0]} ${trendChartHeight - PAD_Y} Z`
      : '';
  const labelIndexes = trendDateLabelIndexes(points.length);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={{ height: trendChartHeight }}>
        {width > 0 && points.length > 0 && (
          <Svg width={width} height={trendChartHeight} style={StyleSheet.absoluteFill}>
            {axis.ticks.map((tick) => (
              <Line
                key={tick}
                x1={0}
                y1={yOf(tick)}
                x2={plotWidth}
                y2={yOf(tick)}
                stroke={colors.separator}
                strokeWidth={1}
              />
            ))}
            {areaPath !== '' && <Path d={areaPath} fill={withAlpha(colors.accent, 0.1)} />}
            {linePath !== '' && (
              <Path
                d={linePath}
                fill="none"
                stroke={colors.accentStrong}
                strokeWidth={LINE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <Circle cx={xs[lastIndex] ?? 0} cy={ys[lastIndex] ?? 0} r={DOT_RADIUS} fill={colors.accentStrong} />
          </Svg>
        )}
        {width > 0 &&
          axis.ticks.map((tick, index) => (
            <Text
              key={`label-${tick}`}
              testID={`${testID}:tick:${index}`}
              style={[
                styles.tick,
                { top: yOf(tick) - 8, width: AXIS_WIDTH - space.xs, color: colors.text2 },
              ]}
              numberOfLines={1}
            >
              {trendTickLabel(tick, axis.step)}
              {index === axis.ticks.length - 1 ? ` ${unit}` : ''}
            </Text>
          ))}
      </View>
      <View style={[styles.dateRow, { width: plotWidth || undefined }]}>
        {labelIndexes.map((index) => (
          <Text
            key={`date-${index}`}
            testID={`${testID}:date:${index}`}
            style={[styles.dateLabel, { color: colors.text2 }]}
          >
            {trendDateLabel(points[index]?.at ?? '')}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tick: {
    ...typography.caption,
    position: 'absolute',
    right: 0,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  dateLabel: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
});
