// Expo config plugin: declare <queries> for what the day navigation adapter must see.
// Android 11+ (API 30) hides other packages and intent handlers from PackageManager unless they are declared
// (https://developer.android.com/training/package-visibility/declaring):
// - <package>: without it getPackageInfo("app.organicmaps") throws NameNotFoundException even when Organic
//   Maps IS installed, and the Go tab would wrongly report "not installed".
// - <intent> (ACTION_VIEW + a data scheme): without it Intent.resolveActivity for a geo: link returns null even
//   when a map app can handle it.
const { withAndroidManifest } = require("expo/config-plugins");

const PACKAGE_NAME_PATTERN = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;
const VIEW_ACTION = "android.intent.action.VIEW";

function viewIntent(scheme) {
  return {
    action: [{ $: { "android:name": VIEW_ACTION } }],
    data: [{ $: { "android:scheme": scheme } }],
  };
}

function hasViewIntent(intents, scheme) {
  return intents.some(
    (intent) =>
      (intent.action ?? []).some((a) => a.$["android:name"] === VIEW_ACTION) &&
      (intent.data ?? []).some((d) => d.$["android:scheme"] === scheme),
  );
}

module.exports = function withPackageQueries(config, { packages = [], intentSchemes = [] }) {
  const invalidPackages = packages.filter((name) => !PACKAGE_NAME_PATTERN.test(name));
  const invalidSchemes = intentSchemes.filter((name) => !SCHEME_PATTERN.test(name));
  if (invalidPackages.length > 0 || invalidSchemes.length > 0) {
    throw new Error(
      `with-package-queries: invalid package(s) [${invalidPackages.join(", ")}] or scheme(s) [${invalidSchemes.join(", ")}]`,
    );
  }
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const queries = manifest.queries ?? [{}];
    const block = queries[0];
    const existingPackages = (block.package ?? []).map((entry) => entry.$["android:name"]);
    block.package = [
      ...(block.package ?? []),
      ...packages
        .filter((name) => !existingPackages.includes(name))
        .map((name) => ({ $: { "android:name": name } })),
    ];
    const intents = block.intent ?? [];
    block.intent = [
      ...intents,
      ...intentSchemes.filter((scheme) => !hasViewIntent(intents, scheme)).map(viewIntent),
    ];
    manifest.queries = queries;
    return mod;
  });
};
