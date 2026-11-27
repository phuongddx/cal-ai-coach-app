/**
 * CCChartCard + CCChartDescriptor (Components/Content.swift). The Swift chart
 * is a LineMark + PointMark pair (2.5pt lime line, last point enlarged) on a
 * 160pt frame with automatic axes; here it is drawn with react-native-svg.
 * `.accessibilityChartDescriptor` does not exist in RN — the chart-a11y
 * contract is makeChartDescriptor(), whose data also feeds the accessibility
 * label (RESEARCH Pitfall 2 in the Swift sources).
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { typography, useTokens } from '../tokens';

export type ChartPoint = {
  date: Date;
  value: number;
  label: string;
};

export type ChartDescriptor = {
  title: string;
  xAxis: { title: string; categoryOrder: string[] };
  yAxis: { title: string; minimum: number; maximum: number };
  series: Array<{
    name: string;
    isContinuous: boolean;
    dataPoints: Array<{ x: string; y: number }>;
  }>;
};

/** The AX chart descriptor data for a point list (title "Trend", as in Swift). */
export function makeChartDescriptor(points: ChartPoint[]): ChartDescriptor {
  const values = points.map((point) => point.value);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  return {
    title: 'Trend',
    xAxis: { title: 'Date', categoryOrder: points.map((point) => point.label) },
    yAxis: { title: 'Value', minimum: min, maximum: max },
    series: [
      {
        name: 'Series',
        isContinuous: true,
        dataPoints: points.map((point) => ({ x: point.label, y: point.value })),
      },
    ],
  };
}

/** Two-decimal label form without float artifacts ("82.05", not "82.05000…01"). */
export function formatChartValue(value: number): string {
  return String(Number(value.toFixed(2)));
}

export type ChartCardProps = {
  points: ChartPoint[];
  title?: string;
};

const CHART_HEIGHT = 160;
const PAD_X = 8;
const PAD_Y = 10;

export function ChartCard({ points, title = '' }: ChartCardProps) {
  const { colors } = useTokens();
  const [width, setWidth] = useState(0);
  const descriptor = makeChartDescriptor(points);
  const last = points.length - 1;

  const xs = points.map((_, index) =>
    points.length === 1 ? width / 2 : PAD_X + ((width - 2 * PAD_X) * index) / (points.length - 1),
  );
  const min = descriptor.yAxis.minimum;
  const max = descriptor.yAxis.maximum;
  const span = max - min || 1;
  const ys = points.map((point) => {
    const normalized = (point.value - min) / span;
    return CHART_HEIGHT - PAD_Y - normalized * (CHART_HEIGHT - 2 * PAD_Y);
  });

  return (
    <View
      testID="chart-card"
      accessible
      accessibilityLabel={`${descriptor.title}. ${points
        .map((point) => `${point.label}: ${formatChartValue(point.value)}`)
        .join(', ')}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {title.length > 0 && (
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      )}
      {width > 0 && points.length > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          {/* Axis grid lines, white 0.05 as in the Swift axes. */}
          {[0, 0.5, 1].map((fraction) => {
            const y = PAD_Y + fraction * (CHART_HEIGHT - 2 * PAD_Y);
            return (
              <Line
                key={fraction}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            );
          })}
          {points.length > 1 && (
            <Line
              x1={xs[0] ?? 0}
              y1={ys[0] ?? 0}
              x2={xs[last] ?? 0}
              y2={ys[last] ?? 0}
              stroke={colors.accentLime}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {points.map((point, index) => (
            <Circle
              key={point.date.getTime()}
              cx={xs[index] ?? 0}
              cy={ys[index] ?? 0}
              r={index === last ? 8 : 4.5}
              fill={index === last ? colors.accentLime : 'rgba(255,255,255,0.3)'}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.subhead,
    marginBottom: 4,
  },
});
