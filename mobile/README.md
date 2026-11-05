# mobile

React Native (Android) app for the courier. Offline-first: the phone is the local source of truth and sends idempotent event batches to the backend.

> Status: shell/outbox/sync (#6) and home/open shift P3-P7 (#133). Login remains #7; supply reception P8 is #134. Normal production opening is gated on the missing B-13 map manifest. See decision 98 below.

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
src/screens/           Home shell, Inbox (P28), Settings (partial P31)
src/features/shift-open/ P3-P7, durable draft/local shift, catalog/map/photo ports
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


## M-04: home and open shift (#133)

Design mapping: `S02-Inicio` = P3 home / P4 motorcycle; `S03-Moto` = P5 safety
checklist / P6 odometer / P7 maps; `S04-Insumos` = P8 supply reception (#134,
excluded). The route `openShift` restores its internal step. Home shows the real
local shift and its upload outcome; the day view P9 remains #8. Four preparation
steps replace the board's five because P8 is excluded. No assignment or motorcycle
availability is invented when B-05/bootstrap data is absent.

- The courier types/confirms the motorcycle code. The server can subsequently
  reject it as unknown, blocked or in use; receipt and rejection are shown
  separately. A known block from the saved catalog also prevents opening.
- Every ACTIVE `motorcycle-check-item` from `/field/catalog/` is required. The
  endpoint returns active items only. Missing/empty is unconfigured and blocked.
  **Update safety catalog** explicitly downloads it through `packages/api-client`
  and stores its version/items in SQLite `kv`. Rules snapshot content/version is
  also saved. A changed catalog requires explicit reconfirmation; retired captured
  checks are retained and require supervisor help, never silently filtered away.
- `MapPreparationSource` supplies manifest/version, explicit coverage, licensed
  PMTiles assets and verification results (local file ref, size/hash), and persists
  progress/error before publishing. Ready requires nonempty coverage and verified
  files matching every manifest size/hash when supplied. Retry receives the saved
  preparation; download/network/GPS errors never imply readiness. Production returns
  `unavailable`: **normal production opening stays gated until B-13 provides the
  manifest [ASSUMPTION, owner to confirm]**. No public OSM tile download is added.
- A severe result still records/enqueues `shift.open`, as #68 requires, but never
  permits departure, even without maps. UI asks the supervisor to arrange fleet
  clearance (`motorcycle.unblock` belongs to supervisor/admin in api-conventions).
  It never claims an incident was created or a supervisor was notified offline.
- Odometer input is integer km and is retained verbatim through edits/restart.
  A decrease from the maximum locally known opening/closing reading warns but
  permits capture; the server owns the true reference. Changing motorcycles clears
  safety answers/photo references and requires a new checklist; the raw odometer
  remains visible for the courier to confirm again.
- Photo references are durable local file refs in `OpenShiftDraft` and remain with
  the immutable captured shift. `PhotoCapturePort` adds no native dependency;
  production says **not available in this build**. Odometer photo is optional
  **[ASSUMPTION]** (P6 does not mark it required). Catalog-required photos and the
  board's minor-fault photo gate departure. Severe evidence capture remains possible
  under decision 3 above. Photo upload/native camera qualification is not claimed.
- Schema migration **3** adds one durable draft/local-shift slot. The draft owns
  both client shift UUID and opening event UUID from creation. One service queue,
  the singleton SQLite slot and unique outbox event id prevent duplicate opening.
  `engine.enqueue(event, projectionStatements)` commits the immutable envelope,
  photo refs and local-shift projection in one SQLite transaction. Only after commit
  can the UI show phone-saved; a failed transaction retains the draft. A later
  sync refresh failure cannot turn a successful commit into `OutboxWriteError`.
- A server-rejected opening offers **Correct and try again** on Home and P7.
  This explicit action creates a blank motorcycle-step draft with fresh shift/event
  UUIDs. The rejected outbox envelope/result stays unchanged and is never resent.
  Pending/sending/error, accepted and in-review openings cannot be replaced.
  Schema migration **4** permits only a rejected slot to yield to a new draft;
  the outbox immutability triggers remain in force. A guarded update compares the
  original rejected event id, preventing competing corrections from replacing a
  newer attempt. Ordinary start/resume never resets a rejected attempt.
- Snapshot refreshes publish only the latest requested read at the same edit
  revision. Unmount invalidates in-flight reads, so a delayed pending snapshot
  cannot hide a newer rejection or overwrite courier input.
- Envelope: `shift.open`, schema 1, draft `shift_id`, original event id, actual
  capture `device_time`, saved catalog/rules versions, `gps: null`,
  `manual_capture: true`. Pending/sending/error never imply server receipt;
  accepted/in_review/rejected are distinct server outcomes. Review resolution is
  explicitly unconfirmed; #22 decisions are not available through this sync shape.
  A future close must capture its own timestamp and reuse the shift UUID.
- Severe notes are mandatory, other notes optional **[ASSUMPTION]**; every Other
  needs text. No signature/new incident payload is invented beyond #68's contract.
- New actions have 56 dp minimum targets and explicit labels/states; fields have
  native textbox roles/labels; notices/progress use live regions. `AppText`, theme
  tokens, wrapping layouts and shared es-MX/en copy cover all new UI. Login, token
  refresh, identity/database scope ownership and local lock remain #7; this feature
  uses the current pinned bearer client without choosing organization routes.

Runtime compatibility note: the generated client's two field snapshot responses
are annotated as arrays, while `CatalogSnapshotViewSet.list` and the rules endpoint
return the documented object. M-04 validates the response as `unknown` at its boundary
and rejects malformed snapshots; generated files are untouched. Reconcile that
annotation when regenerating the contract. The existing 30 s snapshot request limit
follows the sync worker's timeout assumption. No new dependency was added.

### Acceptance evidence

`test/m-04.test.ts` maps to #133 as follows:

| Criterion | Tests |
|---|---|
| No-shift to durable open / one UUID | AC flow: actual SQLite file close/reopen, step recovery, commit before return, concurrent second open |
| Safety | AC safety, severe, blocked, odometer, map, catalog, evidence: nonempty required checklist, Other/severe notes, server motorcycle rejections, size/hash/coverage, retained decrease |
| Offline/restart / truthful storage | AC offline, storage, recovery, map recovery: original UUID once, pending/error labels, rollback after insert, failed input retained, durable progress/retry |
| Rejection correction | Regression: new shift/event UUIDs, retained rejected envelope, only the new event uploads; non-rejected states cannot be replaced |
| Refresh ordering | Regression: deferred reads completed in reverse retain rejection; edit/unmount invalidation blocks stale publication |
| Accessibility matrix | Native implementation present; TalkBack, 130% text, light/dark and both locales on qualified devices remain UNVERIFIED |

Ordinary tests use the in-memory SQLite support. One durability test closes and
reopens a temporary SQLite file; this is real database reopen evidence, not an
Android force-stop/device certification claim. There is no mobile e2e harness, so
`mobile/e2e/m-04.spec.ts` is intentionally not added. APK CI, real API/device flows,
native SQLite, Galaxy S24 Ultra SM-S928B/Android 16 and the arm64/4 GB/64 GB/Android
13+ profile must be qualified by the orchestrator. Docker is blocked in this task.
