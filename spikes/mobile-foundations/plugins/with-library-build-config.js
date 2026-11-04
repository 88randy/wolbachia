// Expo config plugin: turn BuildConfig generation back on for chosen Android library modules.
// Android Gradle Plugin 9 generates no BuildConfig class by default (buildFeatures.buildConfig is false),
// and @nozbe/watermelondb 0.28 reads BuildConfig.DEBUG in its native module. We do not fork the library:
// the generated root build.gradle enables the feature for that project only.
const { withProjectBuildGradle } = require("expo/config-plugins");

const MARKER = "// with-library-build-config";

const PROJECT_NAME_PATTERN = /^[\w-]+$/;

function buildSnippet(projectNames) {
  const invalid = projectNames.filter((name) => !PROJECT_NAME_PATTERN.test(name));
  if (invalid.length > 0) {
    throw new Error(`with-library-build-config: invalid Gradle project name(s): ${invalid.join(", ")}`);
  }
  const names = projectNames.map((name) => `'${name}'`).join(", ");
  return `
${MARKER}
subprojects { subproject ->
  if ([${names}].contains(subproject.name)) {
    subproject.plugins.withId('com.android.library') {
      subproject.android.buildFeatures.buildConfig = true
    }
  }
}
`;
}

module.exports = function withLibraryBuildConfig(config, { projects }) {
  return withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += buildSnippet(projects);
    }
    return mod;
  });
};
