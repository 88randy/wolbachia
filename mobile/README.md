# mobile

React Native (Android) app for the courier. Offline-first: the phone is the local source of truth and sends idempotent event batches to the backend.

> Status: shell/outbox/sync (#6) and home/open shift P3-P7 (#133). Day list/offline map/navigation P9-P10 (#135) is implemented against fixture-backed producer contracts; native/device qualification is pending. Login remains #7; supply reception P8 is #134. Normal production opening is gated on the missing B-13 map manifest. See decision 100 below.

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
src/navigation/        typed stack, screen router and durable geo navigation adapter
src/screens/           Home shell, Inbox (P28), Settings (partial P31)
src/features/shift-open/ P3-P7, durable draft/local shift, catalog/map/photo ports
src/features/day/        P9-P10, bundle projections, local work overlay, location/map ports
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
local shift and its upload outcome; the day view P9 is delivered under M-06 #135. Four preparation
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


## M-06: day list, offline map and navigation (#135)

Design mapping: `S05-Dia.png` / `S05-Dia.dc.html`: P9 risk-ordered list,
closed-house revisit section, completed day, offline/error states and point detail;
P10 full-screen map, missing-map alternative and location freshness. Routes `day`
and `map` enter from the local open-shift card. Selection and the last navigation
outcome/time live in SQLite `kv`, so returning/resuming or reopening Day restores
the same locally assigned point. A compare-and-set prevents a late launch outcome
from restoring a cleared selection or overwriting a newer point. Detail has status/action/distance, navigation,
recent history, reference and scanner hint. Gasoline/scanner/incident bottom actions,
emergency and closing-shift actions are owned by other issues and omitted. The
navigation button says "How to get there", without claiming a specific navigator.

- Migration **5** appends downloaded assignment/map projections and singleton bundle
  metadata. Full bootstrap stages validated rows in memory and commits the entire
  replacement plus its cursor in one SQLite transaction. A shared network turn serializes the entire sync pass against bootstrap; short
  projection turns also arbitrate current-assignment navigation against revocation.
  Cached reads and capture do not wait on this network turn. Delta SQL conflict guards retain
  stable resource/version deduplication and remove tombstones; bootstrap restores
  every present resource authoritatively, including equal versions. Delta writes precede
  cursor settlement; a failed write cannot advance the cursor. Replaying after a
  failed settlement is safe. `invalid_cursor` releases the original events, obtains
  bootstrap **without If-None-Match**, installs its cursor and resends the same UUIDs.
- Projection writes never alter drafts, immutable outbox envelopes or attachments.
  Pending/sending/error/in-review work is matched **inside** the projection write
  transaction. A changed/removed task keeps its original point/ownership visible
  with "Kept: pending work" and a notice listing affected point codes. The newest
  server payload is staged separately from the retained view; after pending work
  is received, the current projection becomes visible. Revoked
  session/scope download access clears projections, saved map preparation/navigation
  and the cursor, retaining unsent evidence. Expired auth/network failures keep cache.
- **[ASSUMPTION]** #109/#196 have not published assignment payloads. The single
  tolerant parser accepts `{id, point_code, ovitrap_id?, action, date, risk, version,
  status, block_code, quadrant_id, lat, lng, reference?, history?}` as supplied by the
  lead. Malformed assignment rows are dropped and counted in a localized notice. Unknown risk
  sorts as normal; unknown history/status codes receive a translated fallback.
  Delta numeric versions are ordered numerically; opaque versions deduplicate by equality
  and ordered change sequence. Bootstrap authoritatively restores present resources and removes missing ids.
- **[ASSUMPTION]** #9 captures reference `payload.task_id` or `payload.ovitrap_id`.
  `LocalWorkOverlay` is a replaceable port over the existing outbox. Explicit task ids
  take precedence. Completion fallback uses the same ISO capture date/action
  **[ASSUMPTION]** until downloaded organization timezone metadata is published;
  evening local-time capture may therefore remain uncounted without a task id.
  Pending retention conservatively matches the ovitrap regardless of date, so
  this uncertainty never drops recoverable work from the list. Day progress
  overlays local captures on server status. Phone-saved and server-received text
  remain separate; the existing `SyncChip` opens the inbox with actual delivery/review
  outcomes. Neither an error nor a pending upload implies server delivery/review.
  No new capture queue, upload transport, ping producer or server lookup was added.
- Bootstrap uses `packages/api-client`, validates `unknown` at the runtime object
  boundary (generated response incorrectly says array) and sends the stored bundle
  version as a quoted ETag. 304 preserves cache. Open/reconnect/foreground/due-time
  triggers refresh while cached list/point actions remain usable. Local map
  verification is published before HTTP starts, including a stalled transport.
  A response from a changed bearer token or server is discarded.
- Foreground `expo-location` runs only while Day/Map is mounted, the app is active
  and a local shift is open. Background/unmount stops subscriptions, including
  late permission/watch completions. No local fix is persisted or uploaded.
  **[ASSUMPTION]** display freshness is 60 s, independently of MO08 upload pings;
  stale/denied/unavailable fixes never produce distances. Weak accuracy is labelled
  only with a downloaded `max_gps_accuracy_m` rule; otherwise show age/accuracy.
- M-04 `MapPreparationSource` and saved `verifiedAssets` own file preparation.
  P10 rechecks local file readability, PMTiles v3/MVT header, size and SHA-256 before
  mounting MapLibre. Matching manifests supply quadrant coverage. Missing/corrupt/
  oversized files or renderer failure show the list alternative and verification
  retry. **[ASSUMPTION]** SHA-256 uses whole-file Expo Crypto with a **32 MiB technical
  verification cap** to bound memory until native streaming is qualified on the
  low-resource profile; larger maps fail closed with the list alternative.
- Local style sources are exclusively `pmtiles://file:///...`, with Protomaps earth,
  landuse, water, roads and buildings using shared theme tokens. No OfflineManager,
  demo/public tiles, HTTP tiles/styles/glyphs/sprites or spike imports are used.
  **[ASSUMPTION]** licensed archives use the spike's Protomaps v4 layers. Fonts/glyphs
  for tile labels are not bundled: tile text labels are intentionally absent; the
  app's bundled Inter markers show folio plus color/icon/text status. Attribution
  **© OpenStreetMap contributors** remains visible. Maps have no ScrollView/FlatList
  parent, preserving pinch/pan gestures.
- Production map download is **blocked: no download URL in the manifest contract**.
  The preparation port remains unavailable; no production downloader was invented.
  Real map journey evidence requires licensed assets supplied through M-04's port.
- `NavigationLauncher` validates finite/range coordinates, formats six decimals
  and percent-encodes only the point code into a `geo:` URI. Android Linking checks
  a handler before launch; absent/denied/invalid outcomes give localized alternatives
  and selectable coordinates/reference. Package visibility declares ACTION_VIEW/geo
  plus optional Organic Maps visibility. Device Owner allowlisting is deployment
  configuration; `launched` means Linking resolved, not that navigation/return was
  qualified. A failed local state write is never reported as success.
- AppText, wrapping layouts, theme tokens, runtime-free shared es-MX/en catalogs,
  existing mobile translation adapter and 56 dp controls are reused. Login/native
  i18next migration remain separate work; no additional i18n runtime was introduced.

### Dependencies and primary references

Only mobile workspace dependencies were added; exact versions match the validated
spike: `@maplibre/maplibre-react-native` **11.5.1** for the native local PMTiles
renderer; `expo-location` **58.0.20** for foreground permission/fixes;
`expo-file-system` **58.0.13** for local file/header/bytes verification. Expo and
MapLibre maintain these packages. Reusing these proved APIs avoids a second native
map or file stack. Minimum Expo MapLibre/location and Android package-query plugins
are registered; existing blocked permissions are unchanged. No background permission.

References: [MapLibre local PMTiles and offline-pack limitations](https://maplibre.org/maplibre-native/android/examples/data/PMTiles/),
[Expo foreground location](https://docs.expo.dev/versions/latest/sdk/location/),
[Expo filesystem](https://docs.expo.dev/versions/latest/sdk/filesystem/),
[React Native Linking](https://reactnative.dev/docs/linking),
[Android package visibility](https://developer.android.com/training/package-visibility/declaring).
The installed package declarations and #64 source were also checked for these versions.

### Acceptance evidence

`test/m-06.test.ts`, Node runner over actual SQLite SQL, maps to #135:

| Acceptance checkbox | Evidence / limit |
|---|---|
| Airplane cold-start list/map | New service reads cached assignments/risk/manifests with failing transport; pure coverage verifies licensed local asset. Native rendering/airplane force-stop remains UNVERIFIED |
| Assignment delta / GPS-independent list / navigation | Upsert/remove/version guards retain pending work and original ownership, including a second capture after staged payload adoption; cursor stays unchanged on projection failure; GPS denied/unavailable/stale produces no distances; launcher present/absent/denied/invalid and durable selection |
| Offline/restart wiring / truthful delivery | Invalid-cursor recovery bootstraps unconditionally and resends original UUID; outbox remains the only queue; transactional storage failure rolls back cache; revocation retains unsent evidence |
| Accessibility matrix | Native implementation present; TalkBack, 130% text, light/dark and es-MX/en on qualified devices remain UNVERIFIED |

There is no mobile e2e harness: **do not infer real-API e2e from Node fixtures**;
`mobile/e2e/m-06.spec.ts` is intentionally not added. APK CI/typecheck cover native
integration only when run; this task does not run Expo builds, Playwright or Docker.
Real Organic Maps navigation/return and Device Owner dedicated-mode allowlist return
are **UNVERIFIED**. The #64 S24 result qualifies only that spike build, not this app
or Organic Maps. Galaxy S24 Ultra SM-S928B/Android 16 and the separate arm64/4 GB/
64 GB/Android 13+ profile, storage/performance and complete accessibility matrix are
**UNVERIFIED**. Fixture contracts need reconciliation with merged producers and the
current GitHub issue inventory before publication (the task supplies issue text;
no authenticated inventory lookup was available).


### Adversarial review regressions (#135)

- A successful final upload carrying `X-Session-Revoked: true` propagates through
  both sync transports. Its empty typed sections do not refresh projections. Sync
  settles the returned event results first, then
  clears downloaded assignments/manifests, saved map preparation, navigation state
  and cursor using the same serialized revocation hook. It stops with sign-in
  required instead of sending another batch. Acknowledged and unsent outbox
  envelopes remain intact; clearing access never deletes evidence.
- Bootstrap is an authoritative replacement: every resource present is restored,
  including an equal-version resource previously hidden by an empty bootstrap.
  Only deltas use the resource-version deduplication guard. Repeating a bootstrap
  while a newer server payload is staged keeps the original pending-work view.
- Empty manifest version/checksum, zero size and `licensed=false` are persisted
  reported unavailable states. They replace prior asset metadata and invalidate
  coverage immediately; any declared unavailable asset prevents map readiness,
  even when another asset is still verified. The missing-map/coverage messages
  and list alternative remain usable. Structurally malformed manifests reject
  bootstrap/delta application before writes or cursor advancement.

Deterministic regressions in `test/m-06.test.ts` cover final-upload transport plus
outbox retention, same-version bootstrap restoration, repeated staged bootstrap,
all four unavailable-manifest signals alongside another valid asset, and malformed
manifest cursor retention. These use SQLite and a scripted API-client transport,
with no timing sleeps. The native/API/device UNVERIFIED limits above are unchanged.
