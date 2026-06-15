module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 worklets plugin — MUST be last. Enables the gesture-driven
    // surfaces (Tier 4). Requires a Metro cache clear + native rebuild.
    plugins: ["react-native-worklets/plugin"],
  };
};
