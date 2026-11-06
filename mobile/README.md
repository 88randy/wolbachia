# mobile

React Native (Android) app for the courier. Offline-first: the phone is the local source of truth and sends idempotent event batches to the backend.

> Status: shell/outbox/sync (#6) and home/open shift P3-P7 (#133). P1/P2 login and local unlock are #7 (decision 119); supply reception P8 is #134. Normal production opening is gated on the missing B-13 map manifest. See decision 100 below.

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

**Known native limitation / [ASSUMPTION] durability:** the installed expo-secure-store 58.0.2 Android SecureStoreModule.kt calls saveEncryptedItem without checking its returned SharedPreferences.commit() boolean (non-null writes). A resolved JavaScript setItemAsync therefore does not prove a successful disk commit. A failed commit could lose the last attempt-counter increment, token/status replacement or database-key save after a crash; a read-back cannot establish disk durability. The TypeScript ordering and retry tests cover rejected promises, not this silent native failure. Proposed follow-up issue: make the Android adapter reject commit() == false, add a native disk-failure regression, and validate counter/key recovery on the S24 Ultra. This needs a native/upstream patch; #7 does not change native code or add patch-package.

Design additions without supplied artwork: PIN enter/confirm creation, P1 server setup, throttling/device-deactivation/generic errors and the keep-working action. The S01 logo stays a placeholder. Password reset only shows the supervisor instruction sheet; there is no logout UI.

Verified API references: [OP-SQLite installation](https://op-engineering.github.io/op-sqlite/docs/installation/), [OP-SQLite open/encryption](https://op-engineering.github.io/op-sqlite/docs/api/), [Expo SecureStore SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Expo biometrics](https://docs.expo.dev/versions/latest/sdk/local-authentication/), [noble PBKDF2](https://github.com/paulmillr/noble-hashes). Installed sources also verify Gradle's configuration path and native/TypeScript signatures. Documentation checks do not replace pending Android runtime checks.

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
- **[ASSUMPTION]** Native scanner/camera/GPS integration is unavailable in this build.
  Production `ScannerPort`, `GpsPort` and `EvidencePort` return unavailable/null;
  manual ovitrap UUID and human bag entry work without camera dependencies. A typed
  bag QR preserves its UUID; a scanned bag UUID resolves its human code from cached
  bootstrap context, otherwise the courier must type the printed human code. The
  UUID history stays local even when manual editing removes the active association.
- Physical ovitrap UUIDs are generated on the phone at placement and retained as the
  projection identity. Checks resolve the fixed point/source evidence from a local
  placement or explicit cached assignment; a scanned unknown UUID has an explicit
  location/scope review notice. P13 only offers downloaded assignment points.
  Missing assignment/version/epi week blocks saving; an explicitly lost or narrowed
  downloaded assignment blocks new capture while retaining drafts/outbox.
- Catalog/rules download uses `packages/api-client` and saves snapshots atomically.
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


## M-09: replace, relocate, remove (#138)

P15-P17 are entered from the selected point/physical ovitrap in M-08 and implemented
in [ovitrap-lifecycle](src/features/ovitrap-lifecycle/README.md). ADR 121 records the
owner-supplied decisions. Service/store/ports and `use-m-09` reuse the existing
M-02 outbox and M-08 GPS/evidence/shift authorization patterns. Migration 7 follows
migration 6; it retains immutable captures, reserved replacement UUIDs, evidence,
reasoned void attempts and local relocation decisions. No new queue, HTTP endpoint,
transport, dependency or generated client edit is introduced.

Saving is one SQLite transaction before success. Replacement keeps the point code
and exposes the new physical identity to M-08 while retaining lineage. Explicitly
starting a new M-08 capture archives a pending check whose source was retired;
its input/evidence is retained. Removal requires a deliberate recovered/unrecovered/
unconfirmed choice. Relocation remains Proposed and never moves geometry. Closed-house
suggestions count locally known checks across physical lineage using downloaded OP03
thresholds; unavailable incident history produces no incident-count suggestion.

Phone saved, server received and review result are distinct. A rejected or pending
request never claims delivery. Reasoned corrections preserve every source/photo and
attempt, show each void's delivery/result, and cannot restore a trap over another
active identity or void a proposal with decisions. M-08 abandoned/removed findings
use the no-paddle path and an informational backend-incident notice.

**Design mapping/differences:** S09-Ovitrampa.png/source P15-P17, S15-Ingles and
S16-Accesibilidad were read. The accepted decisions supersede sample pixels: the
replacement UUID is generated/reserved on the phone rather than scanning an invented
assigned-stock API; no stock return or compensation is claimed. P16 records a GPS
proposal rather than placing/moving immediately, and never promises a task tomorrow.
Only a synced task value is displayed. P17 adds explicit unconfirmed recovery;
confirmation uses a bottom sheet. All forms require current GPS/photo and catalog
Other text, use wrapping 56 dp controls/shared tokens and localized copy. Forms are
continuous scrollable sections rather than duplicating the artwork's five-step
stock/paddle workflow; final paddle capture remains M-08. Photo removal offers a
persistent local Undo while the draft is editable; captured evidence is never deleted.

**[ASSUMPTION] integration boundaries:**

- B-33's decision writer and changes-feed producer are absent. `ingestDecision`
  accepts a typed **local** decision/task projection; its camelCase fields are not
  a proposed wire contract. No generic `changes.history` row is interpreted as a
  decision, no approve endpoint exists, rejection never deletes a proposal, and no
  local task is synthesized. The future producer must add a generated wire schema
  and decoder at the existing changes/bootstrap boundary.
- B-15 `is_recovered` is boolean: only recovered sends true. Unrecovered and
  unconfirmed send false; unconfirmed remains a durable flagged local distinction.
- GPS, camera and explicit assignment adapters have the same unavailable production
  defaults as M-08 until the M-01 qualified build supplies them. Missing GPS/photo/
  authorized point remains incomplete. Evidence UUID/file references use existing
  ports and transactional attachment references; B-04 upload integration is absent,
  so no actual photo upload is claimed.
- Existing B-13 ovitrap/point changes are validated and committed alongside receipt
  and cursor by the existing sync pass. Optional historical `is_retired` defaults
  false; retirement and lineage are retained. `courierBundleStatements` stages only
  downloaded projections for the M-01 bootstrap consumer; it does not fetch bundles
  or erase drafts/outbox. Full bootstrap/cursor/scope recovery remains the existing
  integration boundary. Organization routing is the pinned token, never a URL selector.
- Copy uses runtime-free `packages/i18n` through the existing mobile `useT`/
  `translate.ts` adapter, exactly as M-08; no additional i18next runtime is added.
- The manifest's `mobile/e2e/m-09.spec.ts` is intentionally not created: no mobile
  e2e directory/tooling exists. A real file-backed SQLite close/reopen test proves
  local restart persistence and original-UUID retry; it is not force-stop/device proof.

Tests and criterion mapping: [feature README](src/features/ovitrap-lifecycle/README.md).
Native SQLCipher, camera/GPS/navigation, uploads, real API and B-33 feed, TalkBack,
light/dark layout at 130% on the Galaxy S24 Ultra SM-S928B/Android 16 and the
arm64/4GB/64GB/Android 13+ profile still require M-01 build/device qualification.
The Node prop matrix verifies labeled controls, minimum heights, wrapping/scaling
configuration, tokens/locales and modal actions; it cannot certify native layout,
focus return, contrast in sunlight or assistive-technology behavior.
