/** @type {import('jest').Config} */
module.exports = {
  // iOS only for now: Android is out of scope (no Android SDK on this machine).
  preset: 'jest-expo/ios',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
