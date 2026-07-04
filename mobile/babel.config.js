module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 ships its Babel plugin from react-native-worklets.
    // It MUST be listed last.
    plugins: ["react-native-worklets/plugin"],
  };
};
