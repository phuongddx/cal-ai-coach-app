/**
 * RNTL screen test of AchievementsView (PG-04): the streak hero with its
 * freeze chip, the earned and locked badge grids with the days-left copy, and
 * the disabled progress-photos row.
 */
import { render, screen } from '@testing-library/react-native';

import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createRepoFixture, type RepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';

import { createProgressModel } from '../progressModel';
import { AchievementsView } from '../screens/AchievementsView';
import type { ProgressDeps } from '../progressModel';

const USER_ID = DEMO_USER_ID;

async function makeModel(fixture: RepoFixture, seed: boolean) {
  if (seed) {
    const seeder = createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId });
    await seeder.ensureSeeded();
  }
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
  return model;
}

describe('AchievementsView screen', () => {
  it('the streak hero, the badge grids and the progress-photos row render from the seed', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, true);
    await render(<AchievementsView model={model} />);

    // The streak hero: 12-day streak, 1 freeze left, personal-best title.
    expect(screen.getByLabelText('12 day streak, 1 freeze left')).toBeOnTheScreen();
    expect(screen.getByText('Personal best: 18 days')).toBeOnTheScreen();
    expect(screen.getByText('1 freeze left')).toBeOnTheScreen();

    // Earned grid (3) before the locked grid (2), Swift order.
    expect(screen.getByText('Earned badges')).toBeOnTheScreen();
    expect(screen.getByText('Unlock next')).toBeOnTheScreen();
    expect(screen.getByTestId('badge-tile:First Scan')).toBeOnTheScreen();
    expect(screen.getByTestId('badge-tile:7-Day Streak')).toBeOnTheScreen();
    expect(screen.getByTestId('badge-tile:Hydration Habit')).toBeOnTheScreen();
    expect(screen.getByTestId('badge-tile:30-Day Streak')).toBeOnTheScreen();
    expect(screen.getByTestId('badge-tile:50 Scans')).toBeOnTheScreen();

    // Locked tiles carry the days-left copy.
    expect(screen.getByLabelText('30-Day Streak, locked, 18 days left')).toBeOnTheScreen();
    expect(screen.getByLabelText('50 Scans, locked, 32 days left')).toBeOnTheScreen();
    expect(screen.getByLabelText('First Scan, earned')).toBeOnTheScreen();

    // The disabled progress-photos row keeps the copy.
    expect(screen.getByLabelText('Progress photos, coming later')).toBeOnTheScreen();
    expect(screen.getByText('Progress photos')).toBeOnTheScreen();
    expect(screen.getByText('Coming later')).toBeOnTheScreen();
  });

  it('a model without streak state or badges renders only the progress-photos row', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, false);
    await render(<AchievementsView model={model} />);

    expect(screen.queryByLabelText('12 day streak, 1 freeze left')).toBeNull();
    expect(screen.queryByText('Earned badges')).toBeNull();
    expect(screen.getByLabelText('Progress photos, coming later')).toBeOnTheScreen();
  });
});
