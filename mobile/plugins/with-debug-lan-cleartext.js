// Expo config plugin: plain http only in debug builds, never in release.
//
// Why: during development the phone talks to the backend on the PC over Wi-Fi
// (http://<LAN IP>:8000, see mobile/README.md). Release builds must only use https.
//
// How:
// - The main manifest (used by every build type) never allows cleartext traffic: the attribute is
//   removed, so Android's default applies (cleartext blocked for apps that target API 28+).
// - The debug source set (android/app/src/debug) gets a manifest overlay that allows it.
//   AGP merges that overlay only into the debug build; release never sees it.
//
// Limit: Android's network security config cannot express IP ranges, so the OS lets a debug build
// reach any http host. The app narrows this to private LAN addresses itself
// (src/config/api-base-url.ts), and that rule is unit-tested.
const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const DEBUG_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <application android:usesCleartextTraffic="true" tools:targetApi="28" tools:ignore="GoogleAppIndexingWarning"/>
</manifest>
`;

function removeCleartextFromMainManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application?.$) delete application.$["android:usesCleartextTraffic"];
    return mod;
  });
}

function writeDebugManifestOverlay(config) {
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const directory = path.join(mod.modRequest.platformProjectRoot, "app", "src", "debug");
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "AndroidManifest.xml"), DEBUG_MANIFEST, "utf8");
      return mod;
    },
  ]);
}

module.exports = function withDebugLanCleartext(config) {
  return writeDebugManifestOverlay(removeCleartextFromMainManifest(config));
};
