// Metro config for the monorepo. Expo already watches the workspace root and resolves hoisted
// packages; the only addition is to pin React to this app's copy.
//
// Why: React Native 0.88.1 bundles a renderer that requires exactly React 19.3.0
// (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-*.js), while web/ pins
// 19.3.1 and npm hoists that one to the root. Without the pin, react-native (hoisted too) would load
// 19.3.1 and the app would crash with "Incompatible React versions".
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isReact = moduleName === "react" || moduleName.startsWith("react/");
  if (isReact) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, "_pin.js") },
      moduleName,
      platform,
    );
  }
  return upstreamResolve
    ? upstreamResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
