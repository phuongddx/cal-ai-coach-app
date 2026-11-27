import { createHash } from 'node:crypto';

import { defaultEnvFile } from './sqlHarness';

describe('SQL harness env file', () => {
  it('derives the file name from the checkout path, as scripts/rn/start-api.sh does', () => {
    const key = createHash('sha256').update('/repos/coachcal').digest('hex').slice(0, 12);
    expect(defaultEnvFile('/tmp', '/repos/coachcal')).toBe(`/tmp/coachcal-rn-api-${key}.env`);
  });

  it('gives two checkouts two different files', () => {
    expect(defaultEnvFile('/tmp', '/repos/coachcal/.worktrees/a')).not.toBe(
      defaultEnvFile('/tmp', '/repos/coachcal/.worktrees/b'),
    );
  });

  it('names this checkout, so its suites find the cluster it started', () => {
    expect(defaultEnvFile()).toMatch(/coachcal-rn-api-[0-9a-f]{12}\.env$/);
  });
});
