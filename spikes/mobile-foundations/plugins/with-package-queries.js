// Expo config plugin: declare <queries><package .../></queries> for apps this spike must see.
// Android 11+ (API 30) hides other packages from PackageManager unless they are declared
// (https://developer.android.com/training/package-visibility/declaring). Without this,
// getPackageInfo("app.organicmaps") throws NameNotFoundException even when Organic Maps IS installed,
// and the Go tab would wrongly report "not installed".
const { withAndroidManifest } = require("expo/config-plugins");

const PACKAGE_NAME_PATTERN = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/;

module.exports = function withPackageQueries(config, { packages }) {
  const invalid = packages.filter((name) => !PACKAGE_NAME_PATTERN.test(name));
  if (invalid.length > 0) {
    throw new Error(`with-package-queries: invalid package name(s): ${invalid.join(", ")}`);
  }
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const queries = manifest.queries ?? [{}];
    const block = queries[0];
    const existing = (block.package ?? []).map((entry) => entry.$["android:name"]);
    block.package = [
      ...(block.package ?? []),
      ...packages.filter((name) => !existing.includes(name)).map((name) => ({ $: { "android:name": name } })),
    ];
    manifest.queries = queries;
    return mod;
  });
};
