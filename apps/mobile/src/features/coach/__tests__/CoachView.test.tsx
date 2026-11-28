/**
 * RNTL screen test of CoachView (CH-01 + the U-75 Ember restyle): the
 * greeting subtitle and title, the THIS WEEK hero card with its stats, the
 * day's insights with at most one action row — "See the days" opening the
 * local day list; an insight without days shows no row — and the locked
 * trust copy. The ED-safe stat swap renders through the DS component.
 */
import { render, screen, userEvent, within } from '@testing-library/react-native';

import { setEdSafeMode } from '../../../design';
import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createRepoFixture, type RepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';

import { createCoachModel } from '../coachModel';
import { CoachView, insightDayLabel, insightVariant } from '../screens/CoachView';
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

  it('the coach shows the greeting, the hero card, the seeded insights and the trust copy', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, true);
    await render(<CoachView model={model} greeting="Good afternoon" />);

    expect(screen.getByText('Good afternoon')).toBeOnTheScreen();
    expect(screen.getByText('Coach')).toBeOnTheScreen();

    // The THIS WEEK hero card with the stats row inside it.
    expect(screen.getByText('THIS WEEK')).toBeOnTheScreen();
    expect(screen.getByTestId('weekly-review-stats')).toBeOnTheScreen();
    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(screen.getByText('% on target')).toBeOnTheScreen();
    expect(screen.getByText('You logged every day this week — great consistency!')).toBeOnTheScreen();

    // The insights: the three seeded rows, each card's variant by kind.
    expect(screen.getByText('Insights')).toBeOnTheScreen();
    expect(screen.getByText('12-day streak going strong')).toBeOnTheScreen();
    expect(screen.getByText('Hydration is behind')).toBeOnTheScreen();
    expect(screen.getByText('Protein pacing looks good')).toBeOnTheScreen();

    // The locked trust copy (T-P06-01).
    expect(
      screen.getByText(
        'Coach provides supportive guidance based on your data. Not medical advice. No food is "good" or "bad."',
      ),
    ).toBeOnTheScreen();
  });

  it('See the days opens the day list of the insight; an insight without days shows no row', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, true);
    const user = userEvent.setup();
    await render(<CoachView model={model} greeting="Good afternoon" />);

    // The seeded week has seven logged days, so the streak and the weekly
    // average insights carry days; the hydration insight carries none.
    expect(screen.getByTestId('coach.seeDays.streak')).toBeOnTheScreen();
    expect(screen.getByTestId('coach.seeDays.protein')).toBeOnTheScreen();
    expect(screen.queryByTestId('coach.seeDays.hydration')).toBeNull();
    expect(screen.queryByTestId('coach.dayList')).toBeNull(); // closed until pressed

    await user.press(screen.getByTestId('coach.seeDays.streak'));

    const dayList = screen.getByTestId('coach.dayList');
    expect(dayList).toBeOnTheScreen();
    expect(within(dayList).getAllByText(/Jan/)).toHaveLength(7); // the streak's seven logged days

    await user.press(screen.getByTestId('coach.seeDays.streak'));
    expect(screen.queryByTestId('coach.dayList')).toBeNull(); // the row toggles the list closed
  });

  it('the ED-safe mode swaps the kcal-derived stats for the weeks stat on the review card', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, true);
    setEdSafeMode(true);
    await render(<CoachView model={model} greeting="Good morning" />);

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
    await render(<CoachView model={model} greeting="Good evening" />);

    expect(screen.queryByText('Insights')).toBeNull();
    expect(screen.getByText('THIS WEEK')).toBeOnTheScreen(); // the hero card stays
    expect(screen.getByText('You logged 0 of 7 days this week — keep it up!')).toBeOnTheScreen();
  });
});

describe('insight helpers', () => {
  it('the hydration insight is the info variant, the rest accent', () => {
    expect(insightVariant('hydration')).toBe('info');
    expect(insightVariant('streak')).toBe('accent');
    expect(insightVariant('protein')).toBe('accent');
    expect(insightVariant('other')).toBe('accent');
  });

  it('a day of the list formats as its weekday and date', () => {
    expect(insightDayLabel('2026-01-12')).toMatch(/Jan 12|12 Jan/);
    expect(insightDayLabel('not-a-day')).toBe('not-a-day');
  });
});
