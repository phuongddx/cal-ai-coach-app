/**
 * WeightChartDescriptor.swift — the feature-level chart a11y of the weight
 * trend: the AXChartDescriptorRepresentable data over the logged weight
 * series. `.accessibilityChartDescriptor` does not exist in RN; the contract
 * is this descriptor, whose y-range rule (span the data, ±1 for flat series,
 * 0…1 for empty) is part of ChartDescriptorTests.
 */
import type { ChartPoint } from '../../design';

export type WeightChartDescriptorData = {
  title: string;
  xAxis: { title: string; categoryOrder: string[] };
  yAxis: {
    title: string;
    range: { minimum: number; maximum: number };
    gridlinePositions: number[];
    valueDescription: (value: number) => string;
  };
  series: Array<{
    name: string;
    isContinuous: boolean;
    dataPoints: Array<{ x: string; y: number }>;
  }>;
};

/** WeightChartDescriptor.yRange — the numeric axis of the logged data. */
export function weightYRange(points: ChartPoint[]): { minimum: number; maximum: number } {
  const values = points.map((point) => point.value);
  if (values.length === 0) {
    return { minimum: 0, maximum: 1 };
  }
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (!(minimum < maximum)) {
    return { minimum: minimum - 1, maximum: maximum + 1 };
  }
  return { minimum, maximum };
}

export function makeWeightChartDescriptor(points: ChartPoint[]): WeightChartDescriptorData {
  return {
    title: 'Weight trend',
    xAxis: { title: 'Date', categoryOrder: points.map((point) => point.label) },
    yAxis: {
      title: 'Weight (kg)',
      range: weightYRange(points),
      gridlinePositions: [],
      valueDescription: (value: number) => `${value.toFixed(1)} kg`,
    },
    series: [
      {
        name: 'Weight',
        isContinuous: true,
        dataPoints: points.map((point) => ({ x: point.label, y: point.value })),
      },
    ],
  };
}
