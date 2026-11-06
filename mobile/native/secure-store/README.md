# Android SecureStore commit backport (#210)

Temporary source backport for **expo-secure-store 58.0.2**. The upstream issue is
[expo/expo#48988](https://github.com/expo/expo/issues/48988); the actual fix is
[PR #52131](https://github.com/expo/expo/pull/52131), merged as
`064d311c4732d9bde7dd37fcb08cb2294f72854e`. PR #49191 did not merge.

`upstream/` contains the two production Kotlin files from that immutable commit,
without local changes. Expo's MIT copyright/license is retained in `LICENSE`.
`pristine/` contains the original 58.0.2 module and Gradle file, for guarded
fixture tests and the native CI negative control. Those fixtures are never
application source. `manifest.json` records exact SHA-256 hashes for every
installed source/test/build file that the plugin writes.

The original module hash is
`2c1f4172b3779de3e65052ecd0ce61ffef311565052a3fb5d0956c11f26f0deb`.
The upstream Git blob IDs are `53533812f6b76a2389b8e1afac913ae6614ec60b`
for `SecureStoreModule.kt` and `88273bb4bed8adb0e4e47ea9c958214c4edcd002`
for `SecureStorePreferences.kt`. The manifest records their SHA-256 equivalents.

## Behavior and build configuration

The original non-null setter discarded `SharedPreferences.commit()`'s Boolean.
Android changes its in-memory map before disk completion, so a JS read-back
cannot verify durability. The official fix rejects false results, restores prior
values, serializes writes on a separate monitor (avoiding the Android 7 monitor
deadlock), and removes a legacy value in the same commit as its replacement.
It also retains previous values when null/delete commits fail. No JS API,
encryption parameters, key aliases, authentication settings or stored data format
are changed. This does not establish hardware-level storage durability.

`plugins/with-secure-store-commit.js` applies the backport during Android prebuild.
The direct package version is exact, and `mobile/package.json` sets
`expo.autolinking.android.buildFromSource` to `expo-secure-store`. Without
[that setting](https://docs.expo.dev/modules/autolinking/#buildfromsource), Expo
can package its prebuilt AAR and ignore source modifications.

The applicator verifies all payloads before writing, accepts only an entirely
pristine or entirely patched package, and is idempotent. A version/source mismatch,
partial patch or changed native test fails loudly; reinstall and review instead
of adding fuzzy matching. No new npm/Maven dependency is added: the package already
declares JUnit 4.13.2 and Robolectric 4.16. `test-build.gradle` only enables Android
unit-test resources. `robolectric.properties` selects test API 35; production SDK
37 is unchanged. Installed files remain under the resolved package directory.

Before any write, the applicator checks the package root and every existing
ancestor of every destination with lstat, rejecting symlinks/junctions (including
dangling links) and destinations that escape the package directory. The regression
uses real disposable junctions on Windows and directory symlinks on other hosts,
including a later test-source destination, and requires all external file bytes,
permissions and directory nodes to remain unchanged after rejection. Fixture cleanup
unlinks each link itself before validating the real absolute owned temporary paths;
it refuses recursive cleanup if another link remains. See the
[Node filesystem API](https://nodejs.org/docs/latest-v22.x/api/fs.html).

## Regression evidence

`test/secure-store-patch.test.ts` runs with Node and disposable OS-temp directories,
never a second installation in `node_modules`. It protects exact application,
idempotency, dependency/source drift, partial-state rejection and CI-proof parsing.
The existing auth-controller test file adds one refused-write/retry case for login
and one for PIN setup, retaining prior credentials. Existing local-unlock,
session-requests and encrypted-database tests cover their own rejection boundaries.

**Native compilation/tests run only in the existing `mobile-apk` / `debug-apk` CI
job.** `SecureStoreCommitIntegrationTest.kt` calls the real module's private setter
through reflection, using its actual AES encryptor, serialization, authentication
helper (authentication=false), and Android preferences. A test-only KeyStoreSpi
supplies one newly generated AES key; it does not mock persistence or use a device
keystore. Tests temporarily make only their synthetic preferences directory
read-only, restore permission in `finally`, and assert disk bytes, decrypted prior
value, rejection and retry. Null/delete paths affected by the backport are also
checked. No skipped case counts as passing evidence.

The test provider uses Android's numeric-version
[Provider constructor](https://developer.android.com/reference/java/security/Provider).
The host JDK's string-version overload is unavailable in the Android compile API.

`ci-proof.cjs` refuses to run outside `debug-apk` CI. Its negative control restores
only the original module source and runs the real-setter regression. RED is valid
only when exactly that test fails with JUnit's missing-WriteException assertion;
compilation/setup errors, missing reports or skips fail the gate. It restores the
patched module in `finally`, verifies all hashes, and requires all three patched
native tests to pass before assembling the APK. Reports/logs are uploaded from
`build/secure-store-commit`. The APK check also requires the native rejection
string in an actual DEX entry, catching accidental prebuilt-AAR packaging.

The permissions/Robolectric setup and native classpath require an actual CI run;
local Node tests cannot certify them. This JVM test does not execute the JS bridge
or hardware keystore, and APK packaging is not an Android runtime/device test.

## Retiring or updating the patch

First verify an official published Expo version includes PR #52131. Upgrade via
the project's normal compatibility review, remove this plugin/source-build opt-out
and its payload/negative-control machinery, then validate native regression and
APK packaging in CI against the released implementation. A new version must
trigger the current guard; do not update a hash merely to silence it.

Primary APIs: [Expo dangerous mods](https://docs.expo.dev/config-plugins/dangerous-mods/),
[Robolectric setup](https://robolectric.org/getting-started/),
[Android commit contract](https://developer.android.com/reference/android/content/SharedPreferences.Editor#commit()),
[Java KeyStore SPI](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/security/KeyStoreSpi.html),
[Kotlin continuation bridge](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.coroutines.intrinsics/suspend-coroutine-unintercepted-or-return.html).
