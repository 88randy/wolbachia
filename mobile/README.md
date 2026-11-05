# mobile

React Native (Android) app for the courier. Offline-first: the phone is the local source of truth and sends idempotent event batches to the backend.

> Status: bootstrap (issue #6). The shell, tokens, i18n, the local outbox, the sync worker and the sync inbox (P28) exist. Login is #7, the feature screens are the epics #8 to #11. Decisions: [`docs/decisions.md`](../docs/decisions.md) 91 to 93.

## Rules

- Read [`docs/engineering-rules.md`](../docs/engineering-rules.md) and [`docs/glossary.md`](../docs/glossary.md) first.
- Before building a screen, read `design/mobile/README.md`, its PNG in `design/mobile/screens/` and its HTML in `design/mobile/source/`.
- No inline styles or color literals (use `packages/tokens`); no user-facing literals (use `packages/i18n`); API only through `packages/api-client`; never import from `web/`. All enforced by ESLint.
- The courier never counts eggs: only `paddle_present` and `has_eggs` (Yes/No).
- Nothing is deleted on the phone: a correction is a void event. The inbox never offers to delete.
- **Maps are full screen with no surrounding `ScrollView`** (phone test, #64): a map inside a scroll view steals the gestures. Keep this in mind for the map screens of #8.
- Text sizes follow the phone's text-size setting (React Native scales them), which is how the design's "130 %" board is met: use `AppText`, never a fixed height on text, and never `numberOfLines`.

## Layout

```
App.tsx, index.ts      entry (SafeAreaProvider, then AppRoot)
metro.config.js        pins React to this app's copy (see decision 95)
plugins/               Expo config plugin: plain http in debug builds only
src/app/               boot (fonts, database, saved settings), providers, shell
src/config/            API address rule and settings, build-time variables
src/db/                SqlExecutor, migrations, key-value store, op-sqlite adapter
src/outbox/            event envelope, state machine, outbox repository
src/sync/              sync pass, failure table, backoff, engine, chip and inbox models
src/navigation/        typed stack and the screen router
src/screens/           Home (placeholder), Inbox (P28), Settings (partial P31)
src/ui/, src/theme/    components and Codequim theme (tokens from packages/tokens)
src/i18n/              `t(key, params)` over packages/i18n (area `mobile`)
test/                  Node tests; support/ has the in-memory SQLite and a scripted transport
```

Pure logic (state machine, failure table, backoff, chip, inbox model, URL rule) has no React or native imports, so it runs in Node. Imports keep the `.ts` / `.tsx` extension, like the packages.

## How the offline outbox works

1. A feature screen builds a `FieldEvent` envelope ([`docs/sync.md`](../docs/sync.md)) and calls `engine.enqueue(event)`. It resolves when the event is saved on the phone; it never waits for the server. If the write fails (for example the storage is full) it throws `OutboxWriteError` and the screen must say so.
2. The sync worker (`SyncEngine`) sends `pending` events in capture order, in batches, and pulls what changed. It runs while the app is alive: at start, when connectivity returns, when the app comes to the foreground, after enqueue, and after "Intentar ahora". At most one pass runs at a time.
3. Each event ends `sent`, `rejected` or `in_review` (the server's answer, with its code), or is parked as `error` (a request that cannot succeed as built). A killed app leaves events in `sending`; they go back to `pending` at the next start.
4. A malformed or incomplete 200 answer never loses evidence: malformed shapes retry, and missing per-event results count as failed attempts and retry with backoff. A 400 naming specific events parks only those indices; the other events are released.
5. A per-event rejection_quota_exceeded (#56) was not stored by the server. Its immutable envelope stays pending with a persisted retry_at deadline from params.retry_after_seconds; other events continue. A restart, connectivity change or manual retry cannot send it early. The inbox explains the wait in both languages. Invalid/missing quota delay falls back to one day [ASSUMPTION].
6. Sending stops (events stay `pending`) when there is no session, no server address, the phone's clock is wrong, or the account lacks permission. The inbox says why in plain words.

## Run it against the local backend

You need the backend reachable from the phone ([#92](https://github.com/88randy/wolbachia/issues/92) covers the opt-in LAN exposure; until it lands, the compose API listens on `127.0.0.1` only) and a debug APK (see below).

1. Install the debug APK from the pull request (artifact `wolbachia-debug-apk-<sha>`).
2. Open **Ajustes** (gear on the home top bar), field **Servidor**, type `http://<PC LAN IP>:8000` and press **Guardar dirección**. In debug builds, plain http is accepted only for `localhost` and private addresses (`10.x`, `172.16` to `172.31`, `192.168.x`); release builds and any other server need https. A dispatch run of the `mobile-apk` workflow can also bake the address into the APK (input `api_base_url`), and a local bundle reads `EXPO_PUBLIC_API_BASE_URL`.
3. Until login exists (#7), the debug build shows **Pruebas** at the bottom of Ajustes: this phone's id, a field for an access token (kept in memory only) and **Agregar registro de prueba**. Sign in with the phone's id so the session is bound to it (the server answers `device_mismatch` otherwise):

   ```bash
   curl -X POST http://<PC LAN IP>:8000/api/v1/auth/login/ \
     -H "Content-Type: application/json" \
     -d '{"username": "<user>", "password": "<password>", "device_id": "<id shown in the app>"}'
   ```

   Paste the `access` value into the app and press **Usar token**. Then press **Agregar registro de prueba**: it voids a record that does not exist, so a real server answers `rejected` / `void_target_not_found` and the inbox shows it under "Con problema". The access token expires; refresh is #7.
4. Tap the chip in the top bar to open the inbox. Turn on airplane mode to see "Sin señal".

The test tools exist only when the build sets `EXPO_PUBLIC_DEV_TOOLS=1` (the CI debug APK does). Release builds must not.

## Lint, format, type-check and tests

From the repo root (`npm ci` first):

```bash
npx eslint mobile
npx prettier --check mobile
node scripts/typecheck.mjs mobile
npm test --workspace=mobile -- --test-concurrency=1 # Node's test runner, no emulator
```

There is no emulator test yet. What cannot be proven in Node (rendering, TalkBack, the native SQLite module) is checked on the phone with the debug APK.

To check that the JavaScript bundle builds (no Android SDK needed): `cd mobile && npx expo export --platform android --output-dir dist` (`dist/` is ignored).

## Debug APK from GitHub Actions

The APK is built in CI (job `debug-apk` of `.github/workflows/mobile-apk.yml`), not on a developer machine. No JDK, Android SDK or NDK is needed locally.

The job builds this app (`APP_DIR: mobile`). The #1 spike in `spikes/mobile-foundations/` stays as reference and is no longer built by CI.

### When it runs

- On every pull request and push to `master` that touches the app, api-client, tokens, root package manifests or the APK workflow (see its `paths:` filters).
- Changes limited to `packages/i18n/**` or `web/**` do not build an APK. The fast mobile checks in `.github/workflows/mobile.yml` keep their existing filters, including all shared packages. Mobile type-checking still catches i18n breakage; rebuild the APK on the next mobile change or by manual dispatch.
- On demand: GitHub, tab **Actions**, workflow **mobile-apk**, **Run workflow**. The optional `abis` input lists the CPU architectures (default arm64-v8a, enough for current phones; add armeabi-v7a for old 32-bit phones). The optional `api_base_url` input bakes an API address into the APK (see "Run it against the local backend").

### Download

1. Open the run: in the pull request, **Checks**, **mobile-apk**; or in **Actions**, workflow **mobile-apk**, pick the run.
2. Scroll to **Artifacts** at the bottom of the run summary and download `wolbachia-debug-apk-<sha>` (`<sha>` is the first 7 characters of the commit). It is a `.zip` with one `.apk` inside.
3. Unzip it. Artifacts are kept for 14 days; run the workflow again when it expires.

With the GitHub CLI: `gh run download <run-id> --name wolbachia-debug-apk-<sha>`.

### Install on a phone

With a USB cable (developer options and USB debugging on, see `adb devices`):

```bash
adb install -r app-debug.apk
```

APKs from different runs are all signed with the same debug keystore of the Expo template, so a new APK updates the installed one in place. `INSTALL_FAILED_UPDATE_INCOMPATIBLE` only appears when the installed APK was signed another way (for example a build made on another machine): `adb uninstall <package id>` (the app id is `mx.pyrobyte.wolbachia.field`; the spike was `mx.pyrobyte.spikes.foundations`) and install again.

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

## Review hardening (#6)

- Startup recovery and all sync passes share one serialized loop; repeated start calls are memoized. A failed transaction restores interrupted sending events before a later pass.
- Each request carries AbortSignal.timeout(SYNC_REQUEST_TIMEOUT_MS): 30 seconds [ASSUMPTION] until #13. Abort is a network failure. React Native 0.88.1 implements this API in src/private/webapis/dom/abort-api/AbortSignal.js.
- Android backups are disabled and overlay/external-storage permissions are blocked by Expo config. CI checks the generated main manifest for allowBackup=false and no cleartext; debug must explicitly allow LAN cleartext.
- Local write failures from enqueue/retry are announced on screen; Notice uses a polite live region. Inbox timestamps include a localized date outside today.
- No new dependencies. Configuration references: [Expo Android config](https://docs.expo.dev/versions/latest/config/app/), [Expo blocked permissions](https://docs.expo.dev/guides/permissions/), [React Native AbortSignal source](https://github.com/facebook/react-native/blob/v0.88.1/src/private/webapis/dom/abort-api/AbortSignal.js).
