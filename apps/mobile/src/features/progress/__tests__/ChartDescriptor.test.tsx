/**
 * Jest twin of native/App/CoachCalTests/ChartDescriptorTests.swift — one case
 * per Swift test, the same behavior sentence. Runs on a fresh seeded sql.js
 * database per test (the Swift tests use a fresh GRDB pool) with the real
 * repositories, the real snapshot loader and the real streak reconcile.
 */
import { render, screen } from '@testing-library/react-native';

import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createRepoFixture } from '../../../data/repos/testing/fixtures';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { setEdSafeMode } from '../../../design';

import { createProgressModel } from '../progressModel';
import { clampKg } from '../progressMath';
import { makeWeightChartDescriptor, weightTrendA11yLabel, weightYRange } from '../weightChartDescriptor';
import { addDays } from '../progressMath';
import { WeeklyEnergyView } from '../screens/WeeklyEnergyView';
import type { ProgressDeps } from '../progressModel';

const USER_ID = DEMO_USER_ID;

/** `Intl` narrow weekday names, the independent source of the day initials. */
function intlShortWeekday(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'narrow' });
}

async function makeSeededModel() {
  const fixture = await createRepoFixture();
  const seeder = createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId });
  await seeder.ensureSeeded();
  const deps: ProgressDeps = {
    db: fixture.db,
    targets: createTargetRepository(fixture.db),
    tracking: createTrackingRepository(fixture.db, { newId: fixture.newId }),
    engagement: createEngagementRepository(fixture.db),
    ownerId: USER_ID,
    notify: () => undefined,
    subscribe: () => () => undefined,
    now: fixture.clock,
    newId: fixture.newId,
  };
  const model = createProgressModel(deps);
  await model.refresh();
  expect(model.getSnapshot().weights).toHaveLength(8); // seed carries 8 weight logs
  return { model, fixture };
}

describe('ChartDescriptorTests twins', () => {
  beforeEach(() => {
    setEdSafeMode(false);
  });

  // testDescriptorMatchesSeededEightPointSeries
  it('descriptor matches seeded eight point series', async () => {
    const { model } = await makeSeededModel();

    const points = model.weightPoints();
    expect(points).toHaveLength(8);

    const descriptor = makeWeightChartDescriptor(points);
    expect(descriptor.series).toHaveLength(1);
    expect(descriptor.series[0]?.dataPoints).toHaveLength(8);

    const values = points.map((point) => point.value);
    expect(weightYRange(points)).toEqual({
      minimum: Math.min(...values),
      maximum: Math.max(...values),
    }); // descriptor y-range must span the logged data
  });

  // testLogWeightReObservesAndDescriptorUpdates
  it('log weight re-observes and descriptor updates', async () => {
    const { model } = await makeSeededModel();

    await model.logWeight(81.2);

    expect(model.getSnapshot().weights).toHaveLength(9); // log-weight write must re-observe

    const descriptor = makeWeightChartDescriptor(model.weightPoints());
    expect(descriptor.series[0]?.dataPoints).toHaveLength(9);
    expect(model.getSnapshot().weights.some((log) => log.kg === 81.2)).toBe(true); // the logged weight row must be observed
  });

  // testWeightBoundsClampAtModelBoundary — untrusted numeric entry clamps to 40–250 at the model boundary.
  it('weight bounds clamp at model boundary', async () => {
    const { model } = await makeSeededModel();

    await model.logWeight(1_000);
    expect(model.getSnapshot().weights.some((log) => log.kg === 250.0)).toBe(true); // out-of-range high input must clamp to 250

    await model.logWeight(10);
    expect(model.getSnapshot().weights.some((log) => log.kg === 40.0)).toBe(true); // out-of-range low input must clamp to 40

    expect(clampKg(123.456)).toBe(123.5); // values snap to 0.1 steps
  });

  // testWeeklyEnergyLabelsArePresentAsText — week-energy labels must exist as
  // text (day initials + values), never color-only (UI-SPEC a11y backstop).
  it('weekly energy labels are present as text', async () => {
    const { model, fixture } = await makeSeededModel();

    await render(<WeeklyEnergyView model={model} />);

    expect(screen.getByText('Weekly energy')).toBeOnTheScreen();
    expect(screen.getByText('avg 429 kcal')).toBeOnTheScreen(); // the seeded days' average figure

    const clock = fixture.clock();
    const symbols = Array.from({ length: 7 }, (_, index) => intlShortWeekday(addDays(clock, index - 6)));
    const dayInitials = screen.getAllByText(/^[A-Za-z]$/).map((element) => String(element.props.children));
    expect(dayInitials).toHaveLength(7); // 7 day-initial captions expected
    expect(dayInitials.every((initial) => symbols.includes(initial))).toBe(true);

    // Today's seeded meal (Spaghetti Bolognese) is one of the value labels.
    expect(screen.getByText('543')).toBeOnTheScreen();
  });

  // The frame's chart summary (frame 11): the real numbers over the window.
  it('the chart summary reads the real numbers over the window', () => {
    const points = [
      { date: new Date('2026-11-01T00:00:00Z'), value: 82.4, label: '2026-10-27' },
      { date: new Date('2026-11-20T00:00:00Z'), value: 81.5, label: '2026-11-16' },
      { date: new Date('2026-11-24T00:00:00Z'), value: 80.6, label: '2026-11-24' },
    ];
    expect(weightTrendA11yLabel(points, 30)).toBe(
      'Weight trend from 82.4 to 80.6 kilograms over 30 days',
    );
    expect(weightTrendA11yLabel(points, 7)).toBe('Weight trend from 82.4 to 80.6 kilograms over 7 days');
    expect(weightTrendA11yLabel([], 30)).toBe('Weight trend'); // no series, no numbers
  });
});
