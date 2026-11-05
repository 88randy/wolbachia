# mobile

React Native (Android) app for the courier. Offline-first: the phone is the local source of truth and sends idempotent event batches to the backend.

> Status: bootstrap (issue #6). The shell, tokens, i18n, the local outbox, the sync worker and the sync inbox (P28) exist. P1/P2 login and local unlock are implemented in #7; the feature screens are the epics #8 to #11. Decisions: [`docs/decisions.md`](../docs/decisions.md) 93 to 95 and 99.

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

Credentials (issuing origin, token pair, PIN/password verifiers and write-ahead counters) occupy ONE SecureStore JSON item. Login captures its origin at request start and stores it atomically with the accepted pair; the domain reservation blocks server save/reset until login acceptance/failure and persistence have settled. Rules, sync, refresh and final upload always use credentials.origin, never the current server setting. The shared bearer-client boundary ignores a caller-supplied alternate base URL and refuses to attach a replacement origin's bearer to an old client. A final pre-send middleware check also covers explicit sync/final-upload Authorization headers; a stale client is rejected before fetch rather than sending the new origin's bearer to its old target. One CredentialStore command queue owns accepted logins, PIN creation, attempt counters/results, unlock grants, locks, session end and final-upload settlement. Each reducer changes authoritative memory before native I/O; persistence completion never restores an older snapshot. Readers see additions only after persistence. Session end synchronously marks memory ended before its first await, then queues the journal and SecureStore write: a pending fifth wrong password cannot erase the retained pair. Only definitive final-upload settlement may erase an ended pair. No secret enters SQLite, AsyncStorage or logs. Encrypted kv keeps the profile subset (username, first name, organization, permissions), owner binding, session-ended marker and versioned rules snapshot. A confirmed remote end persists a journal containing the session id and end status, then the monotonic credential status. Boot reconciles the journal before interrupted-password exhaustion can erase credentials. The journal reconstructs the ended gate if the process dies between those writes; it never records a consumed network attempt. The local gate closes immediately; after restart the ended session stays on P1 and cannot unlock. The retained pair is private to the final-upload path, never ordinary API calls or refresh. The serialization barrier never retains command rejections: callers receive the individual error, rejected ending promises are released, and the next sync retries any pending end journal/SecureStore persistence before sending. The in-memory ended restriction remains in force throughout.

PINs are four digits, excluding identical digits and ascending/descending runs. PBKDF2-HMAC-SHA256 uses pbkdf2Async, independent random 16-byte salts, a versioned cost record and constant-time comparison. The password verifier is created only after successful online login. PINs never leave the phone; only online login sends a password. PIN creation requires confirmation.

Attempts are saved BEFORE checking a secret. The PIN limit disables PIN and biometrics and requires the full local password. Five wrong local passwords erase both verifiers and tokens, requiring online login. An interrupted fifth password attempt clears credentials on restart too. Outbox events, drafts and the database are never erased. Successful PIN/password verification resets counters. Successful biometrics leave the PIN counter unchanged: they do not demonstrate PIN knowledge. Failed/canceled biometrics change no counter.

The reader consumes only pin_max_attempts (default 3, 1..10), session_idle_minutes (default 5, 1..30), and clock_skew_review_seconds (default 300, 30..3600). A minimal rules fetch runs after login with immediate defaults; it never delays PIN creation. The cached snapshot includes its version. Ended/replaced-session responses are ignored. There is no general configuration sync. The generated rules endpoint describes a collection; the runtime validates the documented single Schemas["RulesSnapshot"] object without changing the client. **Lead follow-up:** pin_max_attempts is not seeded today; default 3 applies pending client confirmation.

The opaque lock overlay preserves the MOUNTED shell, navigation and half-filled forms, hiding covered content from touch and accessibility. Android back cannot pop covered screens. Sync continues. Cold sessions start locked; backgrounding locks immediately. Any touch resets injectable idle deadlines; the one-minute warning includes a keep-working action. With a one-minute idle limit the warning is immediate. Idle warning at T-1 minute, lock at T, touch reset and background lock apply in both unlocked and createPin (including confirmation), and an expired PIN setup requires the local password before creation resumes. The UI phase is derived from credentials plus one in-memory unlocked flag, never independently published: no pair or ended means login; an active locked pair means locked; an unlocked pair without a PIN means PIN creation. Lock clears the flag immediately and revokes stale unlock grants only; it never cancels an accepted login or PIN write. Backgrounding during a pending login save therefore yields a locked session requiring its cached password, then PIN creation. Session notifications wake idle/blocked sync workers with requestSync while preserving in-flight passes and retry deadlines. A persisted local session identity stays stable across token refresh: a valid PIN can finish during sync refresh, while a replaced/revoked session cannot be unlocked by an old result. Interrupted PIN setup requires the cached full password before setup resumes.

Login responses validate nonempty token strings, a parseable server_time and the profile fields consumed by the app before acceptance. Refresh validates both nonempty token strings before returning a replacement. Malformed successful responses are failures and never replace previous credentials. Authenticated requests use SessionRequests.run (rules) or runSync (sync). Active sessions refresh online once on 401 token_expired and retry once; refresh remains single-flight and the new pair is stored BEFORE retrying. A late old-access 401 uses the persisted replacement without consuming another refresh. Successful refresh stays inside the sync pass, avoiding a needsLogin block.

**Session end is two steps, not eager credential deletion.** Step 1 immediately shows P1 with the session-closed notice, even offline, and persists the ended state. PIN/password verifiers are disabled/erased at this step, including after restart; the gate rejects already-running unlock results. No refresh is ever started again for that session. The pair is retained ONLY for final POST /field/sync/ retries using its existing access token, even expired. If refresh confirms revocation after a sync token_expired, retry that POST with the old access token without another refresh.

The server owns final-upload consumption: FinalUploadMixin spends it inside the request transaction and rolls it back on answers >=400; event ids remain idempotent. The client stores only active/ended, with no reservation, attempt-consumption status or crash cleanup. Network failure, timeout, process loss, 5xx, 429, 400 and 413 keep the ended pair. Sync uses its existing backoff, Retry-After, offline wait, cursor correction, splitting and parking policies; parked malformed events still require correction/manual retry. A missing server retains the pair and blocks until configuration is restored. Session-end or token-rotation notifications do not bypass an in-flight sync pass or its scheduled backoff/Retry-After deadline; new or removed sync eligibility still wakes the worker.

Each sync POST records session status at SEND time. Only a POST sent while already ended, or a response carrying X-Session-Revoked: true, can complete the session. A normal 200 sent while active and arriving after another call ends the session is applied normally; the pass then makes an actual final POST, including an empty pull when no events remain. The same explicit pull applies to an active empty POST answered 401/403 with needsFinalUpload; it cannot fall idle before sending the final POST. Only a DEFINITIVE server answer with that provenance completes step 2: 2xx after valid batch results/reviews/cursor are applied and persisted, or 401/403 after the failed batch is settled. A 200 with X-Session-Revoked: true immediately marks local auth ended, then commits the results before clearing the retained pair. Malformed 2xx payloads cannot clear the pair before results have been persisted. After a definitive answer, stop even if has_more is true. Drafts, outbox envelopes and their durable results are never erased. Completion is scoped to the original session id and cannot clear a newer login.

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
