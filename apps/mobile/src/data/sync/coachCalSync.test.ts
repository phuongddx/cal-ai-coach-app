/** Jest twin of `CoachCalSyncTests.swift`. */
import * as CoachCalSync from './index';

describe('CoachCalSyncTests', () => {
  it('module name is exposed', () => {
    expect(CoachCalSync.moduleName).toBe('CoachCalSync');
  });
});
