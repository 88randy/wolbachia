# mobile

## M10 release and blocked release (#139)

Assignments4 release tasks now remain visible in the day list and open P18/P19.
The permits2 capture bundle and eligibility1 data commit with the existing DayStore
writer, cursor and owner/session/scope fences. Actual devices, ReleaseSchedule
bindings, receipt custody, transit policy and original/current safety drive every
gate. P19 provides supervisor reporting and has no proceed override. Raw drafts,
fresh GPS and adopted evidence save through the existing atomic outbox/file journal.
See [release contract, tests and limits](src/features/releases/README.md).

The existing QR router opens actual downloaded release devices. Capture and retry
retain one UUID; phone-saved, server-received and review outcomes remain separate.
Schema20 adds only retained owner-bound drafts after unchanged SQL1-19. No new
handler, ledger, permission grant, transport queue or dependency is introduced.
Sample collection is excluded because #117 is open and sample.collect is not on
master. Native/API/accessibility qualification remains UNRUN; no phone install.

## M15 history, training and settings (#144)

Settings links P29 local shift/event/code history and P30 own training/evaluation
feedback. They consume existing scoped history7/eligibility projections and the
generated B03 reads. A new consumer requires a full bootstrap, even when an old
cursor/ETag is valid. Downloaded personal projections are removed on revocation;
authored drafts, source UUIDs, outbox events and private files remain retained.
See [history](src/features/history/README.md) and
[training](src/features/training/README.md) for contract and test ownership.

P31 saves language, appearance and additional text scaling per local user in one
serialized SQLite value. Failed persistence preserves the previous selection and
shows retry guidance. Closing local access delegates to the existing credential
lock, retaining the server session lifetime and all pending work. Its summary
counts pending events, unfinished drafts and unverified/unbound files independently;
neither a count nor a bundled version is a server-delivery/install receipt.
Organization support comes from the retained authenticated profile's actual
`support_contact`, with an explicit unconfigured state.

Design deviations: the issue's MO03 local lock replaces the design's blocked
destructive logout; unproved activity totals/author names are not invented.
Updater state is unavailable pending #146's signed native updater and B29 service;
P31 shows the running JavaScript bundle version only. No manifest, download,
installation, privacy URL or successful-upgrade receipt is fabricated.

`settings-preferences.test.ts` protects restart, owner isolation, serialized choices
and write failure; `settings-journey.test.ts` protects retained work/credential
lifetime and P31 native-host props in es-MX/en, light/dark and130% text.
Host-prop tests are not TalkBack, physical force-stop, Android installation or
real-API/device qualification. These native checks remain UNRUN; no phone is installed.

## M07 QR scanner and supply detail (#136)

P11/P21 share native camera/torch and explicit manual entry, current scoped local
routing and duplicate feedback. P12 shows actual downloaded lot/unit/assignment
pins without inferred stock or expiry. M08 durable drafts and the existing outbox
own all captures and retry. See [scanner contracts, test map and producer limits](src/features/scanner/README.md).
Sample destinations await #117; supply human labels/codes/expiry and native
MO01/API/accessibility qualification remain unavailable or unrun as documented there.

## M12 incidents and emergency (#141)

P23/P24 retain reports/accidents and private photos offline in the existing
outbox/journal. Supervisor conversations pull through the available REST reads;
cached first-page ownership, missing emergency configuration and delivery limits
remain explicit. See [feature README](src/features/incidents/README.md) for the
contracts, original-source fences, criterion map and unrun native/API gates.

## M11 fuel capture (#140)

P22 captures fuel offline for the current shift's fixed motorcycle. Durable raw
fields survive receipt retake, failed storage and restart; Save shares the existing
outbox/private file journal. Pending receipts and later server/review outcomes stay
distinct. Unknown comparable history remains insufficient data. See the
[feature contract and criterion map](src/features/fuel/README.md). Physical
camera/force-stop/TalkBack/API qualification remains UNRUN.

## M05 courier supplies (#134)

P8 is reachable from the open-shift home. It retains original released lines and
declared units, validates discrepancies and adopts a raster signature before atomic
local save. The existing outbox/file journal owns all retry work. Phone-saved,
signature pending, server ingest and later review outcomes remain separate.
See [feature contract, test map and limitations](src/features/supply-receipt/README.md).
Native/API/TalkBack and MO01 qualification remain UNRUN; no phone installation or
deployment is part of this change.

React Native (Android) app for the courier. Offline-first: the phone is the local source of truth and sends idempotent event batches to the backend.

> Status: shell/outbox/sync (#6) and home/open shift P3-P7 (#133). Day list/offline map/navigation P9-P10 (#135) is aligned to scheduling assignments v2 (#109); native/device qualification is pending. P1/P2 login and local unlock are #7 (decision 116); supply reception P8 is #134. Normal production opening is gated on the missing B-13 map manifest. See decision 100 below.

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
src/auth/              secure credentials, local unlock, rules, refresh and idle policy
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
2. On P1 open **Configurar servidor**, enter the API address and save. Debug builds allow private LAN http; release builds require https. Server settings also remain available in Ajustes.
3. Sign in with signal, then create and confirm a nontrivial four-digit PIN. Login sends the generated device_id and the version in mobile/package.json.
4. Open Ajustes to inspect the device id and add a test event. These tools use the authenticated session; there is no pasted-token field. The test void references a nonexistent record, so the inbox shows void_target_not_found.
5. Tap the sync chip for the inbox. Background the app or wait for idle locking, then unlock offline.
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

## P1/P2 authentication and lock (#7)

Authentication logic and native boundaries live in src/auth/; screens are in src/screens/auth/ and the mounted-shell overlay in src/app/AuthGate.tsx. All API calls use generated packages/api-client methods. Login and refresh clients never attach an access bearer; refresh authenticates with its body token, including when access is expired. P1 includes password visibility, wrong credentials, no signal on first login, remote session end, the supervisor-only password-help sheet, device deactivation and Retry-After rate limiting. Auth and sync share ONE NetInfo subscription in useSyncLifecycle, normalized once by observeConnectivity as isConnected === true. Unknown/disconnected readings hold both offline before sync starts; each later reading updates auth BEFORE waking the engine. isInternetReachable is deliberately ignored: a connected private LAN can reach the backend without Internet (#189). Failed requests use the normal network failure/backoff table. No-connectivity guards, including refresh and final upload, are retryable network waits, never session-ended/needsLogin signals; an online transition automatically wakes the engine while an ended pair is retained. Server setup is visible on P1 only during initial provisioning. The address is part of phone identity: both save and reset require no login in flight, no active/ended token pair, no pending/sending/error events and no stored profile/owner. ServerSettings enforces this inside the credential queue, including writes submitted while login persistence is pending. Settings refuses a bound-phone change with localized supervisor guidance. The existing release https and debug private-http validation still applies. No raw server code is shown.

Owner binding uses one hasLocalRecords query before the login POST: any outbox event (all statuses) OR any durable draft/projection belongs to the previous owner. This includes #133 shift_open_state with an unfinished draft and zero events. Same-owner relogin preserves that draft. Shift-open catalog/rules GETs use SessionRequests.run and credentials.origin; refresh rotation is accepted by session id/origin, while revocation ends local auth and keeps drafts.

Credentials (issuing origin, token pair, PIN/password verifiers and write-ahead counters) occupy ONE SecureStore JSON item. Login captures its origin at request start and stores it atomically with the accepted pair; the domain reservation blocks server save/reset until login acceptance/failure and persistence have settled. Rules, sync, refresh and final upload always use credentials.origin, never the current server setting. The shared bearer-client boundary ignores a caller-supplied alternate base URL and refuses to attach a replacement origin's bearer to an old client. A final pre-send middleware check also covers explicit sync/final-upload Authorization headers; a stale client is rejected before fetch rather than sending the new origin's bearer to its old target. One CredentialStore command queue owns accepted logins, PIN creation, attempt counters/results, unlock grants, locks, session end and final-upload settlement. Each reducer changes authoritative memory before native I/O; persistence completion never restores an older snapshot. Readers see additions only after persistence. Session end synchronously marks memory ended before its first await, then queues the journal and SecureStore write: a pending fifth wrong password cannot erase the retained pair. Only definitive final-upload settlement may erase an ended pair. No secret enters SQLite, AsyncStorage or logs. Encrypted kv keeps the profile subset (username, first name, organization, permissions), owner binding, session-ended marker and versioned rules snapshot. A confirmed remote end persists a journal containing the session id and end status, then the monotonic credential status. Boot reconciles the journal before interrupted-password exhaustion can erase credentials. The journal reconstructs the ended gate if the process dies between those writes; it never records a consumed network attempt. The local gate closes immediately; after restart the ended session stays on P1 and cannot unlock. The retained pair is private to the final-upload path, never ordinary API calls or refresh. The serialization barrier never retains command rejections: callers receive the individual error, rejected ending promises are released, and the next sync retries any pending end journal/SecureStore persistence before sending. The in-memory ended restriction remains in force throughout.

PINs are four digits, excluding identical digits and ascending/descending runs. PBKDF2-HMAC-SHA256 uses pbkdf2Async, independent random 16-byte salts, a versioned cost record and constant-time comparison. The password verifier is created only after successful online login. PINs never leave the phone; only online login sends a password. PIN creation requires confirmation.

Attempts are saved BEFORE checking a secret. The PIN limit disables PIN and biometrics and requires the full local password. Five wrong local passwords erase both verifiers and tokens, requiring online login. An interrupted fifth password attempt clears credentials on restart too. Outbox events, drafts and the database are never erased. Successful PIN/password verification resets counters. Successful biometrics leave the PIN counter unchanged: they do not demonstrate PIN knowledge. Failed/canceled biometrics change no counter.

The reader consumes only pin_max_attempts (default 3, 1..10), session_idle_minutes (default 5, 1..30), and clock_skew_review_seconds (default 300, 30..3600). A minimal rules fetch runs after login with immediate defaults; it never delays PIN creation. The cached snapshot includes its version. Ended/replaced-session responses are ignored. There is no general configuration sync. The generated rules endpoint describes a collection; the runtime validates the documented single Schemas["RulesSnapshot"] object without changing the client. **Lead follow-up:** pin_max_attempts is not seeded today; default 3 applies pending client confirmation.

The opaque lock overlay preserves the MOUNTED shell, navigation and half-filled forms, hiding covered content from touch and accessibility. Android back cannot pop covered screens. Sync continues. Cold sessions start locked; backgrounding locks immediately. Any touch resets injectable idle deadlines; the one-minute warning includes a keep-working action. With a one-minute idle limit the warning is immediate. Idle warning at T-1 minute, lock at T, touch reset and background lock apply in both unlocked and createPin (including confirmation), and an expired PIN setup requires the local password before creation resumes. The UI phase is derived from credentials plus one in-memory unlocked flag, never independently published: no pair or ended means login; an active locked pair means locked; an unlocked pair without a PIN means PIN creation. Lock clears the flag immediately and revokes stale unlock grants only; it never cancels an accepted login or PIN write. Backgrounding during a pending login save therefore yields a locked session requiring its cached password, then PIN creation. Session notifications use engine.hint() to wake idle sync workers, preserving blocked states, in-flight passes and retry deadlines. A persisted local session identity stays stable across token refresh: a valid PIN can finish during sync refresh, while a replaced/revoked session cannot be unlocked by an old result. Interrupted PIN setup requires the cached full password before setup resumes.

Login responses validate nonempty token strings, a parseable server_time and the profile fields consumed by the app before acceptance. Refresh validates both nonempty token strings before returning a replacement. Malformed successful responses are failures and never replace previous credentials. Authenticated requests use SessionRequests.run (auth rules and shift-open catalog/rules) or runSync (sync). Active sessions refresh online once on 401 token_expired and retry once; refresh remains single-flight and the new pair is stored BEFORE retrying. A late old-access 401 uses the persisted replacement without consuming another refresh. Successful refresh stays inside the sync pass, avoiding a needsLogin block.

**Session end is two steps, not eager credential deletion.** Step 1 immediately shows P1 with the session-closed notice, even offline, and persists the ended state. PIN/password verifiers are disabled/erased at this step, including after restart; the gate rejects already-running unlock results. No refresh is ever started again for that session. The pair is retained ONLY for final POST /field/sync/ retries using its existing access token, even expired. If refresh confirms revocation after a sync token_expired, retry that POST with the old access token without another refresh.

The server owns final-upload consumption: FinalUploadMixin spends it inside the request transaction and rolls it back on answers >=400; event ids remain idempotent. The client stores only active/ended, with no reservation, attempt-consumption status or crash cleanup. Network failure, timeout, process loss, 5xx, 429, 400 and 413 keep the ended pair. Sync uses its existing backoff, Retry-After, offline wait, cursor correction, splitting and parking policies; parked malformed events still require correction/manual retry. A missing server retains the pair and blocks until configuration is restored. Session-end or token-rotation notifications are hints that preserve blocked states and backoff/Retry-After deadlines; explicit condition changes wake the worker.

Each sync POST records session status at SEND time. Only a POST sent while already ended, or a response carrying X-Session-Revoked: true, can complete the session. A normal 200 sent while active and arriving after another call ends the session is applied normally; the pass then makes an actual final POST, including an empty pull when no events remain. The same explicit pull applies to an active empty POST answered 401/403 with needsFinalUpload; it cannot fall idle before sending the final POST. Only a DEFINITIVE server answer with that provenance completes step 2: 2xx after valid batch results/reviews/cursor are applied and persisted, or 401/403 after the failed batch is settled. A 200 with X-Session-Revoked: true immediately marks local auth ended, then commits the results before clearing the retained pair. Malformed 2xx payloads cannot clear the pair before results have been persisted. After a definitive answer, stop even if has_more is true. Drafts, outbox envelopes and their durable results are never erased. Completion is scoped to the original session id and cannot clear a newer login. Final upload is level-triggered: only after a pass ends idle does the engine read durable credentials and run again while an ended session retains a pair. Neither the level nor a session hint (`engine.hint()`) resumes blocked (clockWrong, needsLogin, noServer, permission) or waitingRetry passes: an explicit request during the pass (#again), notifyConditionsChanged or the retry timer must resume them; scheduled retries, Retry-After and offline waits remain in force; explicit triggers (enqueue, connectivity back, foreground, Intentar ahora) still run at once as in #6.

Restart in the ended state keeps the pair for retry and never permits PIN/password/biometric unlock or refresh. If a response was lost after a committed final upload, a subsequent 401 confirms that it was consumed and permits cleanup; unsent local evidence remains available after same-user relogin. An offline restart waits for connectivity without consuming or clearing anything. A disconnect between the engine's online check and a session request also retains the pair and schedules the normal retry; reconnecting wakes the pending final upload automatically without a manual sync request.


A different username is refused BEFORE any server call while the phone holds any local record (any outbox status), so another courier never sees or inherits someone else's records; unknown ownership with records is refused too. Reassigning a phone is an IT reprovisioning. The owner binding survives both session-end steps. P1 temporarily disables login until a definitive sync answer finalizes the ended session, so a new login cannot overwrite or supersede the access token before its final POST.


Clock skew compares server_time with phone time at login-response arrival. The non-blocking banner uses defaults immediately and updates after the optional snapshot.

Credential loading separates unusable secret data from the database: malformed JSON or invalid credential/verifier/token/origin fields become an in-memory empty credential state, with no unlock and P1 login. The unreadable SecureStore item is left untouched until a later successful login overwrites it; profile/owner, outbox and drafts remain in the encrypted database. A native SecureStore read failure still propagates as a storage error; it is not mistaken for corrupt JSON.

Migration: a valid pre-origin credential item is bound once to the configured server at load, including an ended pair, and that origin is persisted before startup continues. Later configuration changes cannot migrate it again. **[ASSUMPTION]** this migration trusts the currently configured server as the legacy issuer because the historical origin was never recorded. If no valid server is configured, or an explicitly stored origin is invalid, credentials are unusable and require online login; there is no bearer fallback to a different origin.

## SQLCipher storage (#7)

mobile/package.json sets "op-sqlite": {"sqlcipher": true}. The installed Android build.gradle reads mobile/package.json in this layout. The NEW file is wolbachia_field_encrypted_v1.db. The unreleased #6 debug plaintext file wolbachia_field.db stays untouched: no import, deletion or replacement.

The key is 32 Expo random bytes encoded as hex and held in Keystore-backed SecureStore without user-auth binding so sync runs while locked. When missing, generate a candidate IN MEMORY. Open with name/encryptionKey, require nonempty PRAGMA cipher_version, then actually read SELECT count(*) FROM sqlite_master. Only then save the fresh key; only after saving run durability pragmas/migrations. An existing encrypted file with another key fails the real read; its candidate is never saved and nothing is deleted. SecureStore save failure stops boot before migrations/writes. No file-system dependency or plaintext fallback.

After those existing encrypted-open/key checks, #266 performs a read-only structural
lineage preflight BEFORE OUR WAL/FULL configuration and migrations. Public migrate
also checks the same profiles. Profiles derive from the actual released migration
arrays1–11; user_version, a points table or mutable bootstrap flags alone never
establish compatibility. Empty0 and complete canonical prefixes continue normally;
unmerged M09 families, future versions and incomplete/mixed objects fail closed.
See [db/README](src/db/README.md) for the bounded comparison and exact fixtures.

UnsupportedDatabaseLineageError retains the original database and reaches the
existing localized storage-failure/support screen; only its name is logged. Keep
the retained file and contact support. No reset, uninstall, guessed version or
automatic conversion is a recovery step. This boundary covers OUR SQL calls;
native open/SQLCipher physical behavior remains UNRUN and is not certified by
ordinary Node SQLite or APK compilation.

Biometrics are a UI gate, NOT a key unwrap. The database key and credentials are Keystore-bound but not user-auth-bound. Hardware, enrollment and strong Class 3 enrollment are required. Native authentication requests strong biometrics and disables device-credential fallback.
## Verification and assumptions (#7)

| Criterion / invariant | Lowest-layer evidence |
| --- | --- |
| PIN format/trivial-PIN rejection; salted verifier round trip and wrong secret | test/local-unlock.test.ts |
| Persist before verification; restarted attempts; password-required limit | test/local-unlock.test.ts |
| Cold start locked, offline unlock, biometrics retain PIN attempts and cannot bypass the limit | test/auth-controller.test.ts |
| Remote end or five password failures retain real outbox/draft/owner binding | test/auth-controller.test.ts with Node SQLite |
| Concurrent refresh, late 401, persist before use, offline handling, stale-session responses | test/session-requests.test.ts with deferred promises |
| Refresh inside sync succeeds without needsLogin blocking | test/auth-sync.test.ts |
| Refresh confirms revoke: old-access retry, no second refresh; results precede cleanup | test/session-end.test.ts, deferred refresh/final-response promises |
| X-Session-Revoked disables local unlock immediately, saves results before cleanup, survives restart | test/session-end.test.ts, deferred SQLite commit |
| Network/timeout backoff with same-access retry; 5xx/429/400/413 retention; restart/offline/no-server wait; definitive 401/403 cleanup; retained outbox/drafts | test/session-end.test.ts, real Node SQLite and engine wiring |
| Synchronous end dominates a fifth wrong password during a blocked journal; final POST retains its pair and preserves data | test/auth-transitions.test.ts, deferred verifier/journal and real Node SQLite |
| Session end wakes an idle worker automatically; lock during login persistence requires password before PIN setup | test/auth-transitions.test.ts, deferred final response and SecureStore write |
| Server mutation/reset denied for active/ended pairs, each unsent status or a stored owner; allowed on a fresh phone | test/server-settings.test.ts |
| Late active 200 after rules revoke cannot finalize the session; results persist before the actual final POST | test/session-end.test.ts, deferred response with real Node SQLite |
| Transient secure-write failures do not poison later sync; pending end persists before its next POST | test/session-requests.test.ts |
| Login in-flight blocks server save/reset; forced substitution still routes rules/refresh/sync/final upload to the captured origin | test/auth-origin.test.ts, deferred login and generated client composition |
| Legacy active/ended origin migration persists once; unusable credentials boot into P1 without deleting local evidence | test/credential-recovery.test.ts with real Node SQLite |
| Malformed successful login/refresh cannot poison persisted credentials | test/auth-api.test.ts, generated client and restarted CredentialStore |
| Empty active sync revoked with 401 still sends its final POST | test/session-end.test.ts with the real engine/observer |
| One connectivity publisher maps connected LAN/no Internet to online for auth and sync, with auth published first | test/connectivity.test.ts, pure ports |
| Ended cold start offline and mid-pass disconnect both resume with exactly one final POST on connectivity alone, preserving draft/results | test/connectivity.test.ts, real engine/observer and deterministic barriers |
| Connectivity lost before token_expired is retryable, never needsLogin or an offline refresh | test/auth-sync.test.ts |
| Anonymous device/version-bound auth payloads and refresh-expiry/revoke classification | test/auth-api.test.ts |
| P1 error mapping and Retry-After; rules clamps/defaults; owner policy; clock skew | test/auth-policy.test.ts plus one controller wiring test before the network boundary |
| Warning at T-1, lock at T, touch reset, background lock | test/idle-lock.test.ts with a fake clock |
| Fail closed without cipher or on wrong-key read; key persistence before migrations | test/encrypted-database.test.ts |
| Locale parity and explicit interpolation placeholders | packages/i18n/test/messages.test.ts |

**[ASSUMPTION]** PBKDF2 costs (1000 PIN / 10000 password; pure JS, measured 4.5 s for 20000 iterations under `node --jitless`) need S24 Ultra calibration. The local-password limit of 5 is a lead-selected assumption. Native SQLCipher read failures, Keystore durability/atomic replacement, strong-enrollment reporting, cancel behavior, safe areas, TalkBack and 130% text need APK/device checks. No Android build or Docker run was performed.

**Android secure-write handling (#210):** expo-secure-store is pinned to 58.0.2 with a guarded source backport of [Expo PR #52131](https://github.com/expo/expo/pull/52131), fixing [upstream issue #48988](https://github.com/expo/expo/issues/48988). The Android prebuild plugin verifies the installed version and exact source/test hashes, rejects partial/drifted packages, and applies the official failed-commit rejection and previous-value restoration. Expo autolinking explicitly builds this package from source; a prebuilt AAR would bypass the fix. Rebuild the APK after changing the patch. Login/PIN already propagate rejected secure writes to recoverable in-app storage feedback; the controller cannot advance until the write succeeds, and retry preserves prior credentials. A same-process read-back still cannot establish disk durability. See [native patch provenance and verification](native/secure-store/README.md). The existing debug-apk CI job requires a real-setter permissions-failure RED/GREEN regression and the patched native rejection inside the APK. JVM evidence, JS state tests, JS/native bridge runtime and hardware storage/keystore recovery are separate checks; the latter two require Android runtime evidence and are not certified by Node tests.

Design additions without supplied artwork: PIN enter/confirm creation, P1 server setup, throttling/device-deactivation/generic errors and the keep-working action. The S01 logo stays a placeholder. Password reset only shows the supervisor instruction sheet; there is no logout UI.

Verified API references: [OP-SQLite installation](https://op-engineering.github.io/op-sqlite/docs/installation/), [OP-SQLite open/encryption](https://op-engineering.github.io/op-sqlite/docs/api/), [Expo SecureStore SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Expo biometrics](https://docs.expo.dev/versions/latest/sdk/local-authentication/), [noble PBKDF2](https://github.com/paulmillr/noble-hashes). Installed sources also verify Gradle's configuration path and native/TypeScript signatures. Documentation checks do not replace pending Android runtime checks.

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
- The existing departure gate reads its draft, opening decision and current
  catalog/map coherently. M08 camera acquisition retains a guard for those exact
  validated facts through final reference publication (#253); a late severe review
  cannot be hidden by an unchanged shift UUID. The gate policy is unchanged and
  catalog/map remain available before a shift draft exists. Benign fact changes
  conservatively require a retake; physical qualification remains pending.
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


## M-08: place/check ovitraps (#137)

Design mapping: `S06-Escaner` = scanner/manual entry and P21 invalid code;
`S07-Colocar` = P13; `S08-Revisar` = P14; `S15-Ingles` and
`S16-Accesibilidad` guide English, dark mode and enlarged text. Their PNGs and
P13/P14/P21 HTML sources were inspected. Issue #137 supersedes the missing
Yes/No eggs question in the P14 PNG. P13 groups point, preparation and confirmation;
P14 advances finding -> paddle present -> eggs Yes/No -> conditions/bag/reinstatement
-> confirmation. Closed-house/absent/missing/destroyed skip paddle/eggs/bag.
There is no egg-count input, draft field or event payload field.

### Decisions applied (ADR 119)

- `domain.ts` contains strict ASCII `wbf:1:<kind>:<hyphenated UUID>` parsing,
  conditional boolean eggs and shared route transitions. Kinds are lot, ovitrap,
  bag, release-device and sample. Wrong-kind/failed scans always open P21; only an
  explicit manual action sets `manual_capture=true`. A pending draft for a different
  target blocks switching with a resume message instead of silently editing it.
- Native scanner/GPS integration remains unavailable in this build. Production
  `ScannerPort` and `GpsPort` return unavailable/null; #253 supplies the shared M08/M09 camera
  `EvidencePort`, with physical qualification still pending. Manual ovitrap UUID
  and human bag entry remain available. A typed
  bag QR preserves its UUID; a scanned bag UUID resolves its human code from cached
  bootstrap context, otherwise the courier must type the printed human code. The
  UUID history stays local even when manual editing removes the active association.
- Physical ovitrap UUIDs are generated on the phone at placement and retained as the
  projection identity. Checks resolve the fixed point/source evidence from a local
  placement or explicit cached assignment; a scanned unknown UUID has an explicit
  location/scope review notice. P13 only offers downloaded assignment points.
  Missing assignment/version/epi week blocks saving; an explicitly lost or narrowed
  downloaded assignment blocks new capture while retaining drafts/outbox.
- Catalog/rules download uses `packages/api-client` and saves configuration
  atomically without rewriting the current assignment. A genuinely authoritative
  assignment provider captures a durable authority token before network awaits
  and publishes through a conditional SQL CAS plus the existing session fence.
  Bootstrap narrowing, point invalidation, revoke and publication advance that
  revision in the same transaction, including absent/null authority. Stale writes
  retain drafts/outbox and fail explicitly; no previous assignment copy is replayed.
  Drafts pin catalog labels, hashes, assignment version/week configuration, GPS including
  accuracy, shift and capture time. New catalogs warn without clearing old answers.
  Explicit adoption refuses to discard a retired captured choice's historical label.
  Catalog photo requirements apply to current evidence; an old placement photo is
  retained as source provenance and cannot satisfy a required current visit photo.
- **[ASSUMPTION]** No B-13/B-19 assignment/bootstrap adapter exists on this baseline.
  The factory accepts an assignment port and caches its explicit context; it never
  invents an endpoint, scope, point or week. Production stays gated when that context
  is absent, like M-04's unavailable map port. Bootstrap integration must provide
  assignment points, organization `timezone` and `epi_week` settings from the downloaded
  organization context, optional ovitrap/bag mappings and reuse eligibility. The local
  port accepts `Assignment.organization` typed from generated `MeOrganization`; this
  does not add a backend field or endpoint. Repeat lookup and SQLite persistence use
  one capture-time ISO/MMWR calculation matching `backend/ovitraps/capture.py`. A cached
  package week label never determines capture uniqueness. Missing/invalid week settings
  block saving with an explicit stale-week-context notice; no default is inferred.
- OP03: max paddle reuses defaults to 2; absent bootstrap eligibility offers only a
  new paddle. Durable local uses are added across assignment versions, including
  voided/review captures because physical reuse cannot be undone. Without a server
  reconciliation watermark, overlap with refreshed counters is conservative and can
  disable reuse early; a hash change never grants another reuse. **[ASSUMPTION]**
  50 m distance/50 m accuracy defaults only support local warnings; missing/out-of-bound
  required parameters block capture. B-14 reviews unusable GPS; an injected downloaded
  block policy is enforced. `next_change_at` expiration warns/requires review under
  the stored policy, and no acknowledgement can override a block policy.
- A repeat local ovitrap/epi-week reading offers reasoned void-plus-new. Both new UUIDs,
  `record.void {reason_code, reason}`, replacement, draft, immutable projections,
  source/current evidence references and lineage commit through the existing outbox
  transaction. Reasons need 10 visible characters and at most 1000 code points after
  normalization. Original rows/evidence remain. A new bag code is required because
  B-14 reserves prior codes even after void. Corrections retain current GPS, manual
  flag, shift and snapshots; prior answers never replace current provenance.
  Correction times satisfy source < void < replacement even with a stationary/backward
  clock: reserve 1 ms before the replacement and floor it at source + 2 ms. The
  replacement keeps the draft capture time shown in confirmation. Server ordering
  `(device_time, id)` therefore ignores random UUID order. Server processing remains
  per event: a later replacement rejection leaves the accepted void in effect and
  must be resolved; local atomic enqueue does not imply atomic backend acceptance.
- Lagged paddles remain bagged and lab-countable; the UI explains that index exclusion
  belongs to the server. Reinstatement/preparation and reused paddle provenance remain
  local: they are not extra keys in the strict B-14 payload. Supply/evidence refs are
  bounded UUID lists. No unsupported lifecycle mutation or community notification is
  invented; replacement/relocation/removal destinations belong to B-15.
- Migration **5** adds the durable singleton draft and append-only capture/evidence/
  correction projections. SQL guards enforce capture identity and active weekly reading
  uniqueness. `engine.enqueue(event, projectionStatements)` is the only queue entry.
  A void uses the same outbox insertion helper to insert its replacement atomically.
  Errors never claim Saved; pending/error only proves phone storage. Phone-saved,
  server-received and supervisor-review-confirmation are separate; an accepted ingest
  does not invent a supervisor decision.
- Tokens, `AppText`, wrapping layouts, decimal condition inputs, explicit labels,
  selected/disabled states and live-region notices are native React Native controls.
  M-08 opts the shared header targets into 56 dp, as are its form/actions. No inline
  styles, color literals, user copy or text truncation is added. All copy is in the
  `mobile` i18n area (es-MX/en). Strings go through the existing `translate.ts` over
  `packages/i18n` (no second i18n runtime). No dependency was added.

### Adversarial review regressions (#137)

- Entry from P3 and the capture factory use the real `ShiftOpenService.read()`
  departure authorization (`canDepart`, gate and current shift UUID). Every serialized
  capture mutation checks authorization, and save checks again immediately before
  enqueue, including restored drafts. Blocked shifts keep drafts and show an es-MX/en
  notice; edits and saves remain unavailable until authorization returns. Starting
  place/check under a different authorized shift archives the unsaved old draft,
  including all evidence references and its replacement UUID, before replacing the
  active slot in one SQLite transaction (migration **6**). New-capture controls use
  live departure authorization; the old draft cannot be edited or saved under B.
- Other/reason and the remaining capture text inputs are disabled during a save.
  `update` reports whether its conditional SQLite write applied. A queued edit after
  commit discards the late buffer and throws `ImmutableCaptureError`. The es-MX/en
  notice explicitly says the edit was not saved; the next new-capture/correction
  command is unblocked. Retryable storage errors still retain pending text.
- `test/m-08.test.ts` covers both UUID orders and later replacement failure with the
  backend ordering model, real `severe_check` / `in_review` departure authorization,
  blocked entry/save with a retained draft, November 5/12 under a W45 package,
  unavailable week context, ISO/MMWR local/year boundaries, deferred enqueue, and a
  second writer committing before a conditional update. It also covers rejected A,
  `restartRejected`, authorized B, retained superseded evidence, a cold SQLite reopen,
  and the next command after an immutable late edit. No timer waits are used.

APIs verified against [React Native TextInput](https://reactnative.dev/docs/textinput#editable)
[ECMA-402 DateTimeFormat](https://tc39.es/ecma402/#sec-intl-datetimeformat-prototype-formattoparts),
and [SQLite RETURNING](https://www.sqlite.org/lang_returning.html) (the installed
op-sqlite headers bundle SQLite 3.53.4; native execution remains unverified).
No dependency or sync payload field was added. Native interaction, TalkBack and real
backend acceptance remain outside these Node checks.

### Acceptance map and verification boundary

Node tests: `test/m-08.test.ts`; behavior-specific factories live in `test/support/`.
No case takes two seconds in the focused local run. No duplicate framework tests.

| Issue checkbox | Evidence | Status |
| --- | --- | --- |
| 1. Branches, conditional eggs and no count | Conditional payload whitelist (explicitly excludes egg_count/eggs/count), no-paddle findings, Other/photo/gates, strict QR, UUID bounds; source review of form inputs | Node verified; native UI unverified |
| 2. Place/check/lagged/repeat, fixed point/evidence, taps | Real SQLite place/check/correction journey, current-provenance regression, reserved-bag rejection, rollback, cached/local reuse across bootstrap versions | Node verified; physical journey unverified |
| 3. Offline/restart and later sync | File-backed SQLite close/reopen restores draft and original UUID; interrupted sending recovered through real SyncEngine and scripted transport; failed commit/double save; null/omitted GPS; revoked scope preserves draft | Node verified; phone force-stop/API/upload unverified |
| 4. TalkBack/130%/light-dark/es-MX-en | Native labels/states, AppText, 56 dp targets, scrollable wrapping controls and both locales implemented | **UNVERIFIED** on device |

`measureCheckTaps` walks the same automatic step transitions used by the UI:
**normal = 10 control taps; closed-house = 2 control taps after the resolved target scan**.
Normal includes finding, paddle presence, eggs, paddle type, bag scan, three
reinstatement confirmations, Continue and Save. These budgets assume usable cached
snapshots/assignment/GPS, mapped bag code, no repeat/review and empty optional
conditions. Text entry, keyboard/focus taps, scroll gestures, error/review actions
and the initial target scan are excluded. Optional condition-field focus adds at
least two taps; manual QR entry has a different interaction count. This is a pure
route measurement, not a claim of measured native scanner performance.

There is **no mobile e2e harness**, so `mobile/e2e/m-08.spec.ts` was not created.
Docker, Playwright and emulators were not run. Real backend acceptance/idempotency,
attachment upload/resume, native adapters and Android force-stop remain unverified.
The full accessibility matrix must run separately on the Galaxy S24 Ultra SM-S928B /
Android 16 reference and the arm64/4 GB/64 GB/Android 13+ low-resource profile.
Neither profile is qualified by Node tests. Authentication/phone lock integration
remains the shell/M-01 dependency; capture does not add a parallel auth/session path.

### UI/UX standards (`.claude/skills/ui-ux-standards`): status of M-08

Already met: no `Alert.alert` and no spinners, 56 dp targets, truthful phone-saved / server-received / reviewed states, no text truncation. Left for #203: skeleton loading states, bottom sheets for choices, snackbar with Undo for reversible actions, light haptics on save/scan success, and the contrast audit for outdoor use.

Official references checked for reused APIs: [React Native accessibility](https://reactnative.dev/docs/accessibility),
[React Native text](https://reactnative.dev/docs/text).


### Local handoff verification

Run from the repository root on Windows (`npx.cmd`/`npm.cmd`):

| Command | Result |
| --- | --- |
| `npx eslint mobile packages/i18n` | Passed |
| `npx prettier --check mobile packages docs` | Passed; Markdown and generated artifacts follow the repository ignore rules |
| `node scripts/typecheck.mjs mobile` | Passed |
| `npm test --workspace=mobile -- --test-concurrency=1` | 114 passed, including 24 M-08 cases |
| `git diff --check` | Passed |

This adversarial-fix follow-up was verified locally with the commands above.
GitHub issue access returned HTTP 401; no remote review/CI result is claimed. No commit/push/PR,
Docker, Playwright, emulator or device qualification was performed. No generated
stackdump/test-results artifacts were retained.
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
  is received, migration 8's enrolled event UUIDs stop justifying the retained
  view. An INSERT-only trigger enrolls extra captures made while that view is still
  visible; later captures cannot resurrect it. Receipt settlement never writes
  downloaded projections. The next projection write discards obsolete retention. Revoked
  session/scope download access clears projections, saved map preparation/navigation
  and the cursor, retaining unsent evidence. Expired auth/network failures keep cache.
- The single tolerant parser follows `backend/scheduling/courier_feed.py`'s
  `AssignmentProducerSerializer` (#109 assignments v2, #212 v3): common fields are
  `{id, kind, quadrant_id, courier, revision}`; tasks add
  `{code, point, action, date, category, source, protocol, target}`. Local names map
  code to point_code (the producer's human task code includes :action:YYYY-MM-DD),
  point to point_id, revision to version, and category=high to
  high risk; medium/low/null/unknown are normal for ordering. Allocation rows with
  kind=quadrant_assignment are intentionally ignored for the task list and never
  count as unreadable, in bootstrap or deltas. Malformed task rows are counted.
  The existing #196 `sampling_points` projection supplies coordinates by the
  `task.point` UUID and matching quadrant (#221). Inline or retained task GPS is
  not current location authority. Block code, reference, history and ovitrap
  linkage remain optional enrichment. Missing, retired, malformed or out-of-scope
  points leave tasks listed without distance, map marker or How to get there
  action. The real producer supplies only
  place/check; closed-house/relocate states in the design await capture/point data.
  Delta numeric versions are ordered numerically; opaque versions deduplicate by equality
  and ordered change sequence. Bootstrap authoritatively restores present resources and removes missing ids.
- Assignments v3 `is_completed` alone controls list/map/progress (#229): exact
  true completes, false reopens immediately, absent legacy data remains UNKNOWN.
  Completion can change without an ownership revision increment. Current row
  authority stays separate from any older retained capture context. Local
  pending/sent/in_review/rejected events never count as authoritative completion
  or supervisor review; receipt and outstanding phone work can coexist.
  `LocalWorkOverlay` reads actual immutable M08 capture provenance because real
  M08 envelopes have no task_id and v3 tasks have no ovitrap_id. Delivery joins
  only a unique point/action/captured organization-local date. Missing timezone,
  origin or ambiguous identity stays unlinked in outbox/P28; explicit legacy
  task IDs keep precedence. Existing retained-event enrollment stays unchanged.
  No envelope, captured JSON, file reference or assignment snapshot is rewritten.
  Migration 11 requires a committed unconditional bootstrap even if a parser-
  stripped old cache still has a valid ETag/cursor; offline/304/deltas/restart and
  rollback cannot clear readiness. Full empty/legacy responses clear it once,
  preserving UNKNOWN where no authoritative bit exists. The existing SyncChip
  opens actual delivery/review details. No queue, receipt floor, producer, backend
  lookup or upload transport is added. See `src/features/day/README.md`.
- Bootstrap uses `packages/api-client`, validates `unknown` at the runtime object
  boundary (generated response incorrectly says array) and sends the stored bundle
  version as a quoted ETag when the local projection is ready. Migration 9 records
  durable pending bootstrap readiness for the new point cache. Normal refresh
  omits the ETag and rejects 304 while pending, preserving the existing cursor
  and outbox across failures/restart. Only a successful transactional bundle
  replacement clears readiness; valid-cursor sync does not replace a full body.
  Once ready, 304 preserves cache. Open/reconnect/foreground/due-time
  triggers refresh while cached list/point actions remain usable. Local map
  verification is published before HTTP starts, including a stalled transport.
  A response from a replacement session or changed issuer is discarded; legitimate
  bearer rotation through SessionRequests remains valid.
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
  existing mobile translation adapter and 56 dp controls are reused. Auth/session composition follows master #7 (decision 116); the native
  i18next migration remains separate work. No additional i18n runtime was introduced.

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

### Master #7 integration and field UI standard

The #135 merge retains master's encrypted database, CredentialStore, SessionRequests,
identity-pinned origin and final-upload lifecycle (decision 116; M-06 is decision
122). Bootstrap uses `tokens.getOrigin()` and the 401 refresh wrapper, retains ETag/
304 handling, and checks session identity/origin rather than access-token equality.
The scoped sync adapter delegates refresh/final upload to master's transport and
guards both queued requests and late responses against a replacement session/origin. Ordinary locked sessions
keep their offline assignments and map preparation. Foreground local fixes and
automatic day refresh run only with the auth gate unlocked. The screen model is
keyed by session identity, so a failed replacement-session read cannot expose an
old in-memory assignment snapshot; an ordinary lock keeps the same cache.

Auth end's durable journal normally awaits downloaded-data cleanup using the short
projection gate; it never reacquires the network gate held by SessionRequests.
For a 200 carrying X-Session-Revoked, the integration hook only invalidates writers
and visible memory first. Sync persists all per-event receipts before physical
cleanup, then erases the credential pair only after cleanup succeeds. A failed
cleanup retains the receipt and pair, sets day_cleanup_pending, and retries before
the next bootstrap/sync pass; the durable auth-ended journal also retries at boot.
Boot reconciles ended/missing sessions, and password credential erasure also clears
downloaded projections before another login is permitted. Cleanup removes assigned/map projections, navigation state
and cursor while preserving drafts and outbox evidence. An active POST returning
after logout settles evidence but cannot restore projections/cursor; master's real
final POST still follows. Final results are durable before projection cleanup and
`completeSession` credential erasure. Revocation also invalidates captured local
writers, so late map preparation progress, final metadata saves or file inspection
cannot recreate downloaded state, including a scope revocation that keeps the same
session identity.

P9/P10 follow `.claude/skills/ui-ux-standards/SKILL.md` sections 3/4/12/13: local
reads show motion-free row/card or map skeletons, never an empty-state flash or a
spinner. Static shapes deliberately avoid shimmer/battery cost on field devices.
Refresh is single-flight, keeps the last snapshot/map visible and shows an Updating
chip. Read/refresh/map/action errors keep separate retry actions, optional real API
error-code details and the useful list. Empty assignments offer Refresh; completed
work offers Back to home (shift closing belongs to its own issue). Buttons keep
56 dp targets, shared tokens, AppText and es-MX/en copy. No Alert.alert, haptic
package, new dependency or optimistic audit claim was added.

`test/m-06.test.ts` adds deterministic session refresh/logout/final-upload/boot/lock
regressions and deferred load/refresh/error/retry/stale-read UI-model tests. These
are pure controller/SQLite/API-client checks, not native rendering certification.
Light/dark, 130% text, TalkBack, reduced-motion presentation and actual navigation
return remain UNVERIFIED on devices; no Docker, Playwright or Expo build is run.

### Second adversarial review

`test/m-06.test.ts` adds deterministic regressions mapping to all four findings:

| Finding | Regression evidence |
| --- | --- |
| Real scheduling producer | Serializer-shaped bootstrap/delta fixtures include allocation and null-category task rows; no unreadable noise, fabricated distances, markers or navigation eligibility |
| Final acknowledgement survives cleanup failure | A retained task plus projection UPDATE/DELETE failures still settles the original UUID/result before cleanup; restart retries, and a final receipt upgrades concurrently pending ordinary cleanup |
| Same-session scope revocation clears visible memory | Ready-map snapshot invalidates synchronously despite failed reload; an active-session offline restart also hides pending-cleanup projections and routing |
| Retained payload cannot reappear | Extra capture during retention stays enrolled; after both original UUIDs are received, another capture cannot restore the old view |

The native/device accessibility and navigation qualifications above remain
UNVERIFIED. These regressions use SQLite and controlled promises, never sleeps.

Local verification: ESLint, Prettier check and mobile typecheck pass; mobile tests
pass 214/214 and i18n tests pass 13/13. An earlier simultaneous verification run
exhausted process memory; the required mobile command passes when run separately.
No npm ci/install, Docker, Playwright or Expo build was run for this review.

## Shared mobile visual refresh (#203)

Decision 159 records this refresh. Home shows one delivery-status line and one
actionable blocker, without repeating a pending-receipt warning after server
receipt. PIN unlock uses the profile first name or a neutral greeting when empty.
`test/visual-refresh.test.ts` covers both phone-review regressions.

The shared UI follows #202 / decision 123: cool canvas, surface headers, 20 dp
cards with soft token borders and cheap Android elevation, tinted icon/text pills,
Inter prose and JetBrains Mono data. The old navy header and flatter board styling
in `design/mobile` are historical; #203 takes precedence. Screen workflows,
map styling, API contracts and token values are unchanged.

- `AppText` adds `code` / `status` variants and `isMonospace` for dates, times,
  quantities and identifiers without changing their existing size. Numbers and
  overlines also use mono; badges are uppercase mono. Two JetBrains Mono weights
  are bundled as local TTF assets through the same Expo font mechanism as Inter.
  Direct per-weight imports add about 230 KB to the exported font assets, with no
  runtime download. A failed font load still falls back instead of blocking boot.
- Shared cards, buttons, fields, rows, notices and headers consume existing tokens.
  Inputs keep visible external labels, use a focused border and select mono for
  numeric keyboards. Disabled button text retains its contrasting secondary role.
  Headers, rows and pills wrap; touch controls retain at least 48 dp targets.
  No text receives a fixed height or `numberOfLines`.
- `BottomActions` centralizes the full-width thumb-zone surface and bottom safe
  area for the existing login, unlock and inbox actions.
- `AppScrollView` / `AppFlatList` centralize visible native thin indicators in
  both directions. Native Android controls the indicator color; the iOS
  `indicatorStyle` follows the resolved light/dark theme. ESLint rejects direct
  ScrollView/FlatList imports outside these wrappers, and rejects React Native
  Alert, including alias/namespace/default-import escape routes. No native dialog
  is introduced; existing in-app sheets and inline notices remain the feedback UI.
- Appearance follows live system changes by default. Existing saved Light/Dark
  choices keep their meaning. Settings offers System, Light and Dark; choosing
  System restores live following without changing the stored language or data.

### Review preview and evidence

In a build with `EXPO_PUBLIC_DEV_TOOLS=1`, open Settings → developer tools →
Style preview. The route is guarded by the same flag. Preview examples never
read services, write storage, enqueue events or contact a server; the theme
toggle is local to the preview. It includes fields, disabled state with a reason,
all status tones, loading skeletons, empty and partial-error examples, and retry.

[`preview/README.md`](preview/README.md) documents the repeatable browser harness.
It renders the actual mobile components through React Native Web 0.21.4, using
local font assets. Captures are explicitly labeled **browser renderer**; 130%
is a browser approximation, not native Android qualification. Chrome DevTools
returned inline captures for light/dark and the large-text examples, but its
configured workspace roots denied saving PNGs in this worktree. No alternate
filesystem path was used to bypass that restriction.

Observed browser evidence is recorded in [`preview/evidence.json`](preview/evidence.json).
Both themes, both locales and 130% text fit the 360 dp frame without horizontal
overflow; checked controls measured 48/56 px (inputs expand with large text),
local fonts loaded, switching appearance retained field contents and retry
changed only the example. The browser SVG adapter emits two warnings for native
decorative accessibility props. Browser evidence does not prove outdoor contrast
perception, native layout, TalkBack, safe areas, keyboard avoidance or low-end
performance. Those checks and owner visual approval remain **UNVERIFIED / required
before merge**, together with CI's actual debug APK build.

### Acceptance map

| Criterion | Evidence |
| --- | --- |
| Follow system, preserve explicit settings | `test/visual-refresh.test.ts`: live-system changes vs stored Light/Dark and unknown fallback |
| Mono data and sans prose | Same file: public typography contracts; Android JS export lists four Inter and two JetBrains Mono TTF assets |
| Shared cards, statuses, fields, rows, bottom actions | Actual component browser preview in light/dark; all status tones have icon plus text; owner approval pending |
| Outdoor targets and 130% wrapping | Browser measurements / scaled examples; no fixed text height or truncation; Android/TalkBack pending |
| No native Alert, consistent indicators | ESLint negative probes for aliased, namespace and default imports; all current scroll regions use shared wrappers |
| Existing behavior preserved | Full mobile tests with `--test-concurrency=1`, lint, formatting, typecheck; no API/data model changes |
| Android build and final visuals | JS Android export verified locally; actual APK builds only in CI; owner/device approval pending |

Dependencies: `@expo-google-fonts/jetbrains-mono` 0.4.1 (Expo-maintained,
MIT/OFL-1.1, per-weight local assets) matches the existing Inter integration and
avoids copying font binaries/licenses into app code. `react-native-web` 0.21.4
(MIT, root **devDependency only**, React 18/19 peers) provides an honest renderer
when a phone/emulator is unavailable; the Android entry never imports it.
The harness reuses the existing Vite installation and adds no browser library
to mobile production code. Verified references:
[Expo fonts](https://docs.expo.dev/versions/latest/sdk/font/),
[Expo Google Fonts](https://github.com/expo/google-fonts),
[RN Web installation/compatibility](https://necolas.github.io/react-native-web/docs/installation/).


## Session-data cleanup recovery (#222)

ADR 128 defines the cleanup fence. `AuthController.retrySessionDataCleanup` joins
one in-flight attempt and releases pending authentication/unlock access only after
the clear actually succeeds for the same session, origin and status. A rejected
clear or an old completion leaves that fence closed; it never restores a grant or
replays login/captured writes. Existing session-end journals and final-upload
receipt ordering are unchanged.

Boot retries the same path after loading credentials. A cleanup failure is handled
as a fenced P1 notice with Retry rather than an unusable boot screen; credential or
profile storage-read failures still propagate normally. The optional `beforeSync`
port runs in the existing serialized worker before credential/server/connectivity
gates, so the next sync can retry local cleanup even offline without a session.
The worker's existing storage backoff handles repeat failures. No new queue exists.

P1 reuses its existing full-width action for cleanup Retry without requiring a
connection or filled credentials. A retry tap only retries cleanup. The inline
critical notice remains visible offline in es-MX/en, and successful cleanup dismisses
only its own notice. No new layout, tokens, dependencies or native dialogs were added.
S01/P1 and S14 supplied the error/primary-action references; this cleanup state is
an issue-required addition to the artwork.

| Criterion/invariant | Regression in `test/session-data-recovery.test.ts` |
| --- | --- |
| Failed clear then successful boot retry resets the gate; restart failure stays retryable | `boot retry after a failed clear releases login only after actual success` |
| Repeated failures, offline/no-session/server recovery, dedup across sync/boot/manual retry, no auto-login and retained outbox | `offline sync retries failures before session/server gates and joins boot/manual retry without replay` |
| An old completion cannot expose a replacement session; current-context retry can recover | `an old successful clear cannot release a replacement session's data fence` |

The tests use actual Node SQLite transactions, injected storage failure and deferred
barriers. They verify logical recovery and preserved immutable event references;
Android force-stop, SQLCipher/SecureStore disk behavior, native P1 layout, TalkBack
and 130% text still require the qualified build/device workflow. No native build,
phone, API, Docker or database service is required for this fix.

## M-09: replace, relocate, remove (#138)

P15–P17 use the real point/physical/quadrant provider and whole paired capture
context, explicit owned v2 new start, current owner/session/revision admission and
shared file-owner arbiter. Legacy captures remain recoverable and private; no
Assignment/bags/stock/task authority or original ownership is reconstructed.
Replacement keeps the point code, relocation stays Proposed, and removal records
recovered/unrecovered/unconfirmed. Draft/outbox/evidence commit before Saved.

Current history6/B33 validates all 18 known kinds before cursor/readiness settlement.
Four lifecycle branches materialize; five Lab, eight Supply and aggregate Community
branches are validated before deliberate exclusion, without stock/community rows
or capture authority. Malformed/unknown history rejects the whole atomic page.
Feedback preserves original ingest receipts and distinguishes
review effect, approval currency, nullable audit and actual next-day task reference.
Task action requires its current UUID + point + courier + explicit v3 false state.
Actual #287 advisory uses exact original cutoff/rule provenance and a private,
current owner/session/revision-bound ETag cache; unknown/offline data is unavailable,
never zero. Real Me.limits and delivered void reasons govern corrections. Native
foreground GPS uses day.location; canonical246 adopts and enrolls only confirmed
Save evidence in the same transaction. Undo leaves unconfirmed files local.

The real createDayBundle factory separates retained-final transport from active
capture/read authority: cold-restart final JSON retry works without unlocking or
bootstrap, receipts precede cleanup, and a replacement session fences old cleanup.
Schema16 adds only legacy lifecycle evidence reservation protection after unchanged
evaluated SQL1–15; #266 profiles are source-derived, no reset/adoption is performed.
See [feature README](src/features/ovitrap-lifecycle/README.md) for ownership, ordering,
M1–M5 history, criterion→test evidence and truthful delivery/review states.

Design PNG/source S09/S15/S16 and project UI standards were applied. Issue decisions
win: GPS creates a proposal, never automatic movement/task assignment; replacement
creates a physical UUID without invented stock; P17 has unconfirmed recovery. Forms
wrap and use tokens, localized labels and persistent photo Undo. Host props cover
es-MX/en, light/dark and scale1/1.3, not native assistive technology or layout.

Actual camera acquisition uses the shared [#253](https://github.com/88randy/wolbachia/issues/253) port.
Android force-stop/cold-start/SQLCipher, real GPS/file/network/API/B33 decision/task,
TalkBack, 130% native layout and both MO01 profiles remain UNRUN owner/device gates.
No local Android/e2e/Playwright build or real-API phone certification was performed.
Draft219 remains Refs138; full acceptance is not established by Node/APK results.

## Private evidence transport (#246)

M-08 now copies a port-supplied capture URI into exclusive private document storage,
checks bounded original JPEG/PNG bytes and SHA-256, and retains a proven issuer /
organization UUID / User UUID / device owner in an additive file journal. Migration
10 is released after canonical1–9 on the #102 base; its SQL is unchanged.
The original evidence UUID and event envelope never change after capture. Legacy
references without original ownership provenance are retained locally, not assigned
by username or a fresh Me response. A pre-login SQL CAS arbitrates owner activation
with adopted-only reservations, including a rejected SecureStore write and retry.

The existing SyncEngine owns recovery, one file chain per turn, Retry and backoff.
Normal events with any declared evidence wait for verified finalize; SQL selection
runs before claim/LIMIT and propagates only related attachment blocking. Unrelated
JSON and pulls proceed first. Only Save-enrolled declarations can upload; adopted
or cancelled/Undo photos remain local. Lost PUT/finalize replies resume the same
UUID through renew. Actual sent/in-review receipts allow typed field_event binding;
a late/lost binding response never accepts review or changes an event. Final JSON
retains receipt-before-cleanup as an explicit exception, with no byte/binding calls
under final-upload capability. P28 displays file errors/pending references separately
and its existing Try now wakes the same engine.

Tests in attachments.test.ts and attachment-transport.test.ts use real temporary
files, file-backed SQLite close/reopen, barriers and the actual generated API client
with scripted HTTP responses. They prove file bytes/hash, immutable ownership,
restart/replay/linking, selection fairness, unrelated receipts and stale-context
refusal. They do not execute a live #102 backend or certify native storage/network.

M08 now receives camera-only ImagePicker58.0.10 acquisition through
[#253](https://github.com/88randy/wolbachia/issues/253), with exact unsaved-draft,
owner/session, live shift/assignment and cancellation guards before adoption.
Permission-induced local lock requires unlock/retry before launch; an already
launched same-context camera can finish privately beneath AuthGate. Cold orphan
results are ignored. Pending-photo Undo removes only the draft reference, never
private bytes, journal rows or history. No gallery/microphone permission is used.
Physical acquisition/lifecycle/API/accessibility acceptance remains
[UNRUN](../docs/qa/native-photo-253.md); code/CI is a partial draft delivery. The productive
#138 bridge now preserves its original interactive context and current
physical/scope authority, with partial photo publication and all-writer raw-read
CAS. Migration/profile lineage1–16 and both legacy UUID reservations remain intact.
Generic lifecycle payload/dependency shapes are covered separately. Actual
B-33 decisions/tasks use the actual merged #126/history3 producer; the real device
journey remains unverified.
Owner-authorized Android force-stop, SQLCipher/private-file persistence, camera,
GPS, real uploads/API, TalkBack/130%/light-dark/es-MX-en and both device profiles
remain UNVERIFIED under #138/#130. A Node test or debug-apk does not substitute for
those journeys. See src/attachments/README.md and canonical ADR132.

### Limited #138 preparation after266

This DRAFT integrates the released1–11 prefix, bounded view signatures and exact
M09 suffixes12–14. The canonical266 guard remains before OUR WAL/FULL/migrations;
all seven old unmerged schemas remain unsupported without reset/conversion. One
Attachments instance serves the canonical composition; lifecycle adoption/native
camera253 and126 feedback are still missing. Current completion/point/bootstrap,
attachment invalidation and M09 assignment/physical receipt authority share their
existing transactions. This is partial preparation, not full138/native acceptance.


## P26/P27 close shift (#143)

See [shift-close/README.md](src/features/shift-close/README.md) for retained close drafts,
receipt-backed return/shrinkage, local capture/location shutdown, truthful receipt/review
states and the criterion-to-test map. P3 restores P26/P27 alongside P8 supply receipt.
Closure consumes #134's canonical downloaded receipt/frame data; missing reception/usage
facts stay unavailable. Supply bootstrap readiness also recovers older valid cursors/ETags before
acknowledging the new supply projection. Native/API/accessibility qualification remains pending.
