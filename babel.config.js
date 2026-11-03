module.exports = function(api) {
  const isMetro = api.caller((caller) => caller?.name === 'metro');
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isMetro ? ['./plugins/babelPhosphorImports'] : []),
      'react-native-worklets/plugin',
    ],
  };
};
