/**
 * ProjectionView.swift — the weight projection. Deliberately free of any
 * calorie-energy strings (contract: kg + weeks framing only — the screen test
 * greps every rendered string for the forbidden unit and must stay at zero).
 * The Swift Charts band/line/endpoints are drawn with react-native-svg, like
 * the design system's ChartCard. U-73 adds the frame's axis value labels
 * (three gridlines at real kilogram values), the 35%-opacity shaded band and
 * the hollow goal endpoint.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import { BannerNote, Card, space, typography, useTokens, withAlpha } from '../../design';
import { TargetsEngine } from '@coachcal/core';

import { onboardingCopy } from './onboardingCopy';
import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

const CHART_WIDTH = 288;
const CHART_HEIGHT = 180;
const CHART_LABELS_WIDTH = 32;
const MAX_WEEKS = 156;

type Point = { week: number; weight: number };

export function ProjectionScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  const { colors } = useTokens();

  const start = model.draft.weightKg;
  const goalTarget = TargetsEngine.sanitizedGoalWeightKg(model.draft.goalWeightKg ?? start);
  const pace = TargetsEngine.targets(model.draft).paceKgPerWeek;
  const delta = Math.abs(start - goalTarget);
  const weeks = pace > 0 ? Math.min(Math.ceil(delta / pace), MAX_WEEKS) : 0;

  const path = (rate: number): Point[] => {
    const weeksAtRate = rate > 0 ? delta / rate : Number.POSITIVE_INFINITY;
    const last = Math.max(weeks, 1);
    const points: Point[] = [];
    for (let week = 0; week <= last; week += 1) {
      const progress = Math.min(week / weeksAtRate, 1);
      points.push({ week, weight: start + (goalTarget - start) * progress });
    }
    return points;
  };

  const nominal = path(pace);
  const fast = path(pace * 1.3);
  const slow = pace > 0 ? path(pace * 0.7) : nominal;
  const lower = fast.map((point, index) => ({
    week: point.week,
    weight: Math.min(point.weight, slow[index]?.weight ?? point.weight),
  }));
  const upper = fast.map((point, index) => ({
    week: point.week,
    weight: Math.max(point.weight, slow[index]?.weight ?? point.weight),
  }));

  const kgDifference =
    model.draft.goal === 'gain'
      ? Math.round(Math.max(goalTarget - start, 0))
      : Math.round(Math.max(start - goalTarget, 0));
  const kgLabel = model.draft.goal === 'gain' ? 'kg to gain' : 'kg to lose';

  const weeksAhead = Math.max(weeks, 1);
  const goalDate = new Date(model.currentDate());
  goalDate.setDate(goalDate.getDate() + weeksAhead * 7);
  const goalDateText = `${MONTHS[goalDate.getMonth()]} ${goalDate.getFullYear()}`;

  return (
    <StepScaffold
      title="Your projection"
      subtitle="Based on your inputs"
      progress={model.progress}
      action={() => model.advance()}
    >
      <View style={styles.rows}>
        <View style={styles.headerRow}>
          <View style={styles.headerCell}>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Starting</Text>
            <Text testID="onboarding.projectionStart" style={[styles.headline, { color: colors.textPrimary }]}>
              {Math.round(start)} kg
            </Text>
          </View>
          <View style={[styles.headerCell, styles.trailing]}>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Goal by {goalDateText}</Text>
            <Text testID="onboarding.projectionGoal" style={[styles.headline, { color: colors.accentInk }]}>
              {Math.round(goalTarget)} kg
            </Text>
          </View>
        </View>
        {/* The frames draw the chart on a card in both schemes (light 25 / dark 52);
            the hollow goal endpoint carries the card fill. */}
        <Card>
          <ProjectionChart
            nominal={nominal}
            lower={lower}
            upper={upper}
            accent={colors.accentStrong}
            grid={withAlpha(colors.text3, 0.2)}
            labelColor={colors.text2}
            surface={colors.card}
          />
        </Card>
        {/* The Swift view marks this caption row accessibilityHidden; RNTL queries
            mirror the accessibility tree, so the row stays queryable (see
            parity-detail/onboarding.md — a11y parity gap noted). */}
        <View style={styles.todayRow}>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>Today</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>{weeks} weeks</Text>
        </View>
        <View style={styles.statRow}>
          <StatCard value={kgDifference} label={kgLabel} identifier="onboarding.projectionKg" />
          <StatCard value={weeks} label="weeks" identifier="onboarding.projectionWeeks" />
        </View>
        <View testID="onboarding.projectionDisclaimer">
          <BannerNote text={onboardingCopy.projectionDisclaimer} markdown />
        </View>
      </View>
    </StepScaffold>
  );
}

/** Gridlines stand at real kilogram values, as in the frame (81 / 78.5 / 76). */
function gridLabelText(value: number): string {
  const half = Math.round(value * 2) / 2;
  return Number.isInteger(half) ? String(half) : half.toFixed(1);
}

/** Band + nominal line + endpoint dots + labeled gridlines, like the Swift Charts composition. */
function ProjectionChart({
  nominal,
  lower,
  upper,
  accent,
  grid,
  labelColor,
  surface,
}: {
  nominal: Point[];
  lower: Point[];
  upper: Point[];
  accent: string;
  grid: string;
  labelColor: string;
  surface: string;
}) {
  const all = [...lower, ...upper, ...nominal];
  const maxWeek = Math.max(...all.map((point) => point.week), 1);
  const minWeight = Math.min(...all.map((point) => point.weight));
  const maxWeight = Math.max(...all.map((point) => point.weight));
  const weightPad = Math.max((maxWeight - minWeight) * 0.05, 0.5);
  const yLow = minWeight - weightPad;
  const yHigh = maxWeight + weightPad;

  const x = (week: number): number => (week / maxWeek) * CHART_WIDTH;
  const y = (weight: number): number =>
    CHART_HEIGHT - ((weight - yLow) / (yHigh - yLow)) * CHART_HEIGHT;

  const gridValues = [maxWeight, (maxWeight + minWeight) / 2, minWeight];

  const bandPoints = [...upper, ...[...lower].reverse()]
    .map((point) => `${x(point.week).toFixed(2)},${y(point.weight).toFixed(2)}`)
    .join(' ');
  const linePoints = nominal
    .map((point) => `${x(point.week).toFixed(2)},${y(point.weight).toFixed(2)}`)
    .join(' ');
  const first = nominal[0];
  const last = nominal[nominal.length - 1];

  return (
    <View testID="onboarding.projectionChart" style={styles.chartRow}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        {gridValues.map((value, index) => (
          <Line
            key={`${value}-${index}`}
            x1={0}
            x2={CHART_WIDTH}
            y1={y(value)}
            y2={y(value)}
            stroke={grid}
            strokeWidth={1}
          />
        ))}
        {/* The frame's shaded normal-range band at 35% opacity. */}
        {bandPoints.length > 0 && <Polygon points={bandPoints} fill={withAlpha(accent, 0.35)} />}
        {first !== undefined && last !== undefined && (
          <Line
            x1={x(first.week)}
            y1={y(first.weight)}
            x2={x(last.week)}
            y2={y(last.weight)}
            stroke={accent}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        )}
        {first !== undefined && (
          <Circle cx={x(first.week)} cy={y(first.weight)} r={4} fill={accent} />
        )}
        {/* The goal endpoint is hollow, as in the frame. */}
        {last !== undefined && (
          <Circle cx={x(last.week)} cy={y(last.weight)} r={5} fill={surface} stroke={accent} strokeWidth={2.5} />
        )}
      </Svg>
      <View style={styles.gridLabels}>
        {gridValues.map((value, index) => (
          <Text
            key={`${value}-${index}`}
            style={[styles.gridLabel, { color: labelColor, top: y(value) - 8 }]}
          >
            {gridLabelText(value)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function StatCard({ value, label, identifier }: { value: number; label: string; identifier: string }) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      testID={identifier}
      style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Text style={[styles.statValue, { color: colors.accentInk }]}>{value}</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const styles = StyleSheet.create({
  rows: { gap: space.lg },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCell: { gap: 2 },
  trailing: { alignItems: 'flex-end' },
  caption: { ...typography.caption },
  headline: { ...typography.headline },
  chartRow: {
    flexDirection: 'row',
    alignSelf: 'center',
  },
  gridLabels: {
    width: CHART_LABELS_WIDTH,
    position: 'relative',
  },
  gridLabel: {
    ...typography.caption,
    position: 'absolute',
    right: 0,
    fontVariant: ['tabular-nums'],
  },
  todayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    borderWidth: 1,
    borderRadius: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
