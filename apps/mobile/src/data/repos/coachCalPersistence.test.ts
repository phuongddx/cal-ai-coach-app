/**
 * Jest twin of native/Modules/CoachCalPersistence/Tests/CoachCalPersistenceTests/CoachCalPersistenceTests.swift —
 * one case per Swift test, the same behavior sentence.
 */
import { moduleName } from './coachCalPersistence';

describe('CoachCalPersistenceTests twin', () => {
  it('the module name is exposed', () => {
    expect(moduleName).toBe('CoachCalPersistence');
  });
});
