/** @type {import('jest').Config} */
module.exports = {
  // iOS only for now: Android is out of scope (no Android SDK on this machine).
  preset: 'jest-expo/ios',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // RNTL screens and the sql.js fixtures need more than the 5 s default while other projects build
  // on this machine (two suites timed out at 5 s under a load of 12 with unchanged code).
  testTimeout: 15000,
};
