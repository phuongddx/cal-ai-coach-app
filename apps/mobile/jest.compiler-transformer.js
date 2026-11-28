/**
 * Jest transformer of the compiled run (`npm run test:compiler`). The app compiles with the React
 * Compiler (`experiments.reactCompiler` in app.config.ts); the plain Jest run does not, so a view
 * that only works because it re-renders on every model change passes there and freezes on the
 * Simulator.
 *
 * It is jest-expo's own babel-jest setup with one more Babel caller flag, `supportsReactCompiler`
 * (read by babel-preset-expo/build/common.js `getReactCompiler`), which makes babel-preset-expo
 * add babel-plugin-react-compiler. Metro marks node modules with the caller flag `isNodeModule`
 * and the preset then skips the compiler for them; Jest has one caller per transformer, so two
 * transformers are built and the file path chooses: node modules get the plain one.
 */
const { createTransformer } = require('babel-jest');
const { resolveBabelOptions } = require('jest-expo/src/resolveBabelOptions');

const options = resolveBabelOptions(process.cwd());

const compiled = createTransformer({
  ...options,
  caller: { ...options.caller, supportsReactCompiler: true },
});
const plain = createTransformer({
  ...options,
  caller: { ...options.caller, isNodeModule: true },
});

const pick = (filename) => (filename.includes('/node_modules/') ? plain : compiled);

module.exports = {
  canInstrument: false,
  getCacheKey: (source, filename, transformOptions) =>
    `${pick(filename).getCacheKey(source, filename, transformOptions)}:compiler`,
  process: (source, filename, transformOptions) => pick(filename).process(source, filename, transformOptions),
  processAsync: (source, filename, transformOptions) =>
    pick(filename).processAsync(source, filename, transformOptions),
};
