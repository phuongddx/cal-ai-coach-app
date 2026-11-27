/**
 * RNTL screen test of CoachView (CH-01): the greeting, the day's insights,
 * the weekly review card with its stats and encouragement, the locked trust
 * copy — and the ED-safe stat swap rendered through the DS component.
 */
import { render, screen } from '@testing-library/react-native';

import { setEdSafeMode } from '../../../design';
import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createRepoFixture, type RepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';

import { createCoachModel } from '../coachModel';
import { CoachView } from '../screens/CoachView';
import type { CoachDeps } from '../coachModel';

const USER_ID = DEMO_USER_ID;

async function makeModel(fixture: RepoFixture, seed: boolean) {
  if (seed) {
    const seeder = createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId });
    await seeder.ensureSeeded();
  }
  const deps: CoachDeps = {
    db: fixture.db,
    targets: createTargetRepository(fixture.db),
    engagement: createEngagementRepository(fixture.db),
    ownerId: USER_ID,
    subscribe: () => () => undefined,
    now: fixture.clock,
  };
  const model = createCoachModel(deps);
  await model.refresh();
  return model;
}

describe('CoachView screen', () => {
  beforeEach(() => {
    setEdSafeMode(false);
  });

  it('the coach shows the greeting, the seeded insights, the weekly review and the trust copy', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, true);
    await render(<CoachView model={model} greeting="Good afternoon! 👋" />);

    expect(screen.getByText('Good afternoon! 👋')).toBeOnTheScreen();

    // Today's insights: the three seeded rows.
    expect(screen.getByText("Today's insights")).toBeOnTheScreen();
    expect(screen.getByText('12-day streak going strong')).toBeOnTheScreen();
    expect(screen.getByText('Hydration is behind')).toBeOnTheScreen();
    expect(screen.getByText('Protein pacing looks good')).toBeOnTheScreen();

    // Weekly review: the stats row, the full-week encouragement.
    expect(screen.getByText('Weekly review')).toBeOnTheScreen();
    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(screen.getByText('% on target')).toBeOnTheScreen();
    expect(screen.getByText('You logged every day this week — great consistency!')).toBeOnTheScreen();

    // The locked trust copy (T-P06-01).
    expect(
      screen.getByText(
        'Coach provides supportive guidance based on your data. Not medical advice. No food is "good" or "bad."',
      ),
    ).toBeOnTheScreen();
  });

  it('the ED-safe mode swaps the kcal-derived stats for the weeks stat on the review card', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, true);
    setEdSafeMode(true);
    await render(<CoachView model={model} greeting="Good morning! 👋" />);

    // The swap lives in the DS component; the feature holds no policy branch.
    expect(screen.getByText('Weeks with all meals logged')).toBeOnTheScreen();
    expect(screen.queryByText('% on target')).toBeNull();
    expect(screen.queryByText('kg this week')).toBeNull();
    // The habit framing and the trust copy stay.
    expect(screen.getByText('Days logged')).toBeOnTheScreen();
    expect(screen.getByText('You logged every day this week — great consistency!')).toBeOnTheScreen();
  });

  it('a model without insights renders no insights header', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, false);
    await render(<CoachView model={model} greeting="Good evening! 👋" />);

    expect(screen.queryByText("Today's insights")).toBeNull();
    expect(screen.getByText('Weekly review')).toBeOnTheScreen();
    expect(screen.getByText('You logged 0 of 7 days this week — keep it up!')).toBeOnTheScreen();
  });
});
