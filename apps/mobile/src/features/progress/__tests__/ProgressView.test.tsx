/**
 * RNTL screen test of ProgressView (PG-01): the tab stack — title, weight
 * trend, weekly energy, achievements — and the ED-safe backstop from
 * ProgressSnapshotTests.progressEdSafeHidesWeeklyEnergy: the weekly-energy
 * card vanishes entirely from the stack while the rest stays.
 */
import { render, screen } from '@testing-library/react-native';

import { setEdSafeMode } from '../../../design';
import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createRepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';

import { createProgressModel } from '../progressModel';
import { ProgressView } from '../screens/ProgressView';
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
  return model;
}

describe('ProgressView screen', () => {
  beforeEach(() => {
    setEdSafeMode(false);
  });

  it('the stack shows the title and the three sections over the seed', async () => {
    const model = await makeSeededModel();
    await render(<ProgressView model={model} />);

    expect(screen.getByText('Progress')).toBeOnTheScreen();
    // Weight trend section.
    expect(screen.getByText('Current')).toBeOnTheScreen();
    expect(screen.getByText('Goal')).toBeOnTheScreen();
    // Weekly energy section.
    expect(screen.getByText('Weekly energy')).toBeOnTheScreen();
    expect(screen.getByText('Avg deficit')).toBeOnTheScreen();
    // Achievements section.
    expect(screen.getByText('Earned badges')).toBeOnTheScreen();
    expect(screen.getByText('Unlock next')).toBeOnTheScreen();
    expect(screen.getByLabelText('Progress photos, coming later')).toBeOnTheScreen();
  });

  it('the weekly-energy card vanishes in the ED-safe mode while the rest stays', async () => {
    const model = await makeSeededModel();
    setEdSafeMode(true);
    await render(<ProgressView model={model} />);

    expect(screen.queryByText('Weekly energy')).toBeNull();
    expect(screen.queryByText('Avg deficit')).toBeNull();
    // The weight trend and achievements remain, as the Swift ED-safe snapshot shows.
    expect(screen.getByText('Current')).toBeOnTheScreen();
    expect(screen.getByText('Earned badges')).toBeOnTheScreen();
    expect(screen.getByLabelText('Progress photos, coming later')).toBeOnTheScreen();
  });
});
