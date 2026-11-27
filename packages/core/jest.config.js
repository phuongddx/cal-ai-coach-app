/** @type {import('jest').Config} */
process.env.TZ = 'UTC'; // probe: pin before workers spawn
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node10', ignoreDeprecations: '6.0' } }],
  },
};
