module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['nativewind/babel'], ['babel-preset-expo']],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
