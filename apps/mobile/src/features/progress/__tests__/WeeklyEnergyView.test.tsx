/**
 * RNTL screen test of WeeklyEnergyView (PG-03): the seven value-labeled bars,
 * the day-initial captions and the average footer — and the ED-safe backstop:
 * the whole card renders nothing while the mode is on (the collapse component
 * owns the policy, invariant I7).
 */
import { render, screen } from '@testing-library/react-native';

import { setEdSafeMode } from '../../../design';
import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createRepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';

import { addDays } from '../progressMath';
import { createProgressModel } from '../progressModel';
import { WeeklyEnergyView } from '../screens/WeeklyEnergyView';
import type { ProgressDeps } from '../progressModel';

const USER_ID = DEMO_USER_ID;

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
  return { model, fixture };
}

describe('WeeklyEnergyView screen', () => {
  beforeEach(() => {
    setEdSafeMode(false);
  });

  it('the card shows the seven day columns with value labels and the average footer', async () => {
    const { model, fixture } = await makeSeededModel();
    await render(<WeeklyEnergyView model={model} />);

    expect(screen.getByText('Weekly energy')).toBeOnTheScreen();
    expect(screen.getByText('Avg deficit')).toBeOnTheScreen();
    expect(screen.getByText('−1721 kcal/day')).toBeOnTheScreen(); // 2150 − 429 avg

    // Today's seeded meal is one of the seven per-day value labels.
    expect(screen.getByText('543')).toBeOnTheScreen();
    expect(screen.getAllByText(/^[A-Z]$/)).toHaveLength(7); // one day-initial caption per day

    // The today column carries its accessibility label, as in Swift.
    const todayInitial = addDays(fixture.clock(), 0).toLocaleDateString('en-US', { weekday: 'narrow' });
    expect(screen.getByLabelText(`${todayInitial}: 543 kcal`)).toBeOnTheScreen();
  });

  it('the whole card renders nothing while the ED-safe mode is on', async () => {
    const { model } = await makeSeededModel();
    setEdSafeMode(true);
    await render(<WeeklyEnergyView model={model} />);

    expect(screen.queryByText('Weekly energy')).toBeNull();
    expect(screen.queryByText('Avg deficit')).toBeNull();
    expect(screen.queryByText('−1721 kcal/day')).toBeNull();
    expect(screen.queryByText('543')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });
});
