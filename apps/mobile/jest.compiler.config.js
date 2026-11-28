/**
 * The mobile Jest config with the React Compiler on (`npm run test:compiler`). Everything is the
 * plain config; only the transform of source files changes.
 */
const base = require('./jest.config');
const preset = require('jest-expo/ios/jest-preset');

const compiled = require.resolve('./jest.compiler-transformer');
const transform = Object.fromEntries(
  Object.entries(preset.transform).map(([pattern, entry]) =>
    pattern === '\\.[jt]sx?$' ? [pattern, compiled] : [pattern, entry],
  ),
);

/** @type {import('jest').Config} */
module.exports = { ...base, transform };
