/**
 * Jest transformer: emit a generated .sql migration as its default-exported
 * string — the same shape babel-plugin-inline-import produces for Metro.
 */
module.exports = {
  process(sourceText) {
    return {
      code: `module.exports = ${JSON.stringify(sourceText)};`,
    };
  },
};
