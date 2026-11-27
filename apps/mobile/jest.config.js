/** @type {import('jest').Config} */
module.exports = {
  // iOS only for the spike: Android is out of scope (no Android SDK on the spike machine).
  preset: 'jest-expo/ios',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/'],
};
