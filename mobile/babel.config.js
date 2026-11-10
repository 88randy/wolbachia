// NativeWind v4 (see README, "UI library decision"): className support through react-native-css-interop.
// nativewind/babel also adds the Reanimated 4 plugin, so Expo's own worklets plugin is turned off.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind", reanimated: false, worklets: false }],
      "nativewind/babel",
    ],
  };
};
