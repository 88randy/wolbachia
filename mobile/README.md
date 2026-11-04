# mobile

React Native (Android) app for the courier. Offline-first: the phone is the local source of truth and sends idempotent event batches to the backend.

> Status: stub. The app is bootstrapped in issue #6 (after the foundations spike, #1). There is no `package.json` yet.

## Rules

- Read [`docs/engineering-rules.md`](../docs/engineering-rules.md) and [`docs/glossary.md`](../docs/glossary.md) first.
- Before building a screen, read `design/mobile/README.md`, its PNG in `design/mobile/screens/` and its HTML in `design/mobile/source/`.
- No inline styles or color literals (use `packages/tokens`); no user-facing literals (use `packages/i18n`); API only through `packages/api-client`; never import from `web/`. All enforced by ESLint.
- The courier never counts eggs: only `paddle_present` and `has_eggs` (Yes/No).

## Lint, format and type-check

From the repo root (`npm ci` first):

```bash
npx eslint mobile
npx prettier --check mobile
node scripts/typecheck.mjs mobile
```

`mobile` is already listed in the root `package.json` workspaces; issue #6 adds its own `package.json` and `tsconfig.json` (extending `../tsconfig.base.json`).

## Debug APK from GitHub Actions

The APK is built in CI (job `debug-apk` of `.github/workflows/mobile.yml`), not on a developer machine. No JDK, Android SDK or NDK is needed locally.

Until issue #6 creates the app in this folder, the job builds the #1 spike (`spikes/mobile-foundations/`, set in `APP_DIR` at the top of the job). #6 switches `APP_DIR` to `mobile`.

### When it runs

- On every pull request and push to `master` that touches the `paths:` of the workflow (this folder, `packages/**`, the spike folder, root JS tooling).
- On demand: GitHub, tab **Actions**, workflow **mobile**, **Run workflow**. The optional `abis` input lists the CPU architectures (default `arm64-v8a`, enough for current phones; add `armeabi-v7a` for old 32-bit phones).

### Download

1. Open the run: in the pull request, **Checks**, **mobile**; or in **Actions**, workflow **mobile**, pick the run.
2. Scroll to **Artifacts** at the bottom of the run summary and download `wolbachia-debug-apk-<sha>` (`<sha>` is the first 7 characters of the commit). It is a `.zip` with one `.apk` inside.
3. Unzip it. Artifacts are kept for 14 days; run the workflow again when it expires.

With the GitHub CLI: `gh run download <run-id> --name wolbachia-debug-apk-<sha>`.

### Install on a phone

With a USB cable (developer options and USB debugging on, see `adb devices`):

```bash
adb install -r app-debug.apk
```

APKs from different runs are all signed with the same debug keystore of the Expo template, so a new APK updates the installed one in place. `INSTALL_FAILED_UPDATE_INCOMPATIBLE` only appears when the installed APK was signed another way (for example a build made on another machine): `adb uninstall <package id>` (the spike id is `mx.pyrobyte.spikes.foundations`) and install again.

Without a cable: copy the `.apk` to the phone (Drive, USB storage, email) and open it from the Files app. Android asks to allow installs from that app (Settings, Apps, Special access, Install unknown apps); allow it for that app only, install, and turn it off again.

### What the build is

- Built with Gradle `assembleDebug`, signed with the default debug keystore that the generated Android project carries. There are no signing keys in the repo; release signing and the internal update server are #11.
- The JavaScript bundle is embedded (the job removes the "debuggable variant" shortcut), so the app runs without Metro and offline. The CI step fails if the bundle is missing from the APK.
- Debug APKs are larger and slower than release builds. Do not use them for performance numbers.

### Versions

Required by React Native 0.88.1 and the Expo SDK 58 Android template (details and sources in the PR of issue #63):

| Piece | Version |
|---|---|
| JDK | 17 (Temurin) |
| Gradle | 9.4.1 (wrapper) |
| Android Gradle Plugin | 9.2.1 |
| SDK platform (`compileSdk`) | `android-37.0` (compileSdk 37) |
| Build-Tools | 37.0.0 |
| NDK | 27.1.12297006 |

When React Native or Expo is upgraded, re-read `node_modules/react-native/gradle/libs.versions.toml` and update the `env:` block of the job.
