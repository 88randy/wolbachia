# Mobile foundations spike: REPORT

Issue: #1. How to run each test: `README.md` in this folder.
Status: **TEMPLATE, values blank.** The owner fills this in after testing on real company phones.

Result scale: **works** / **works with caveats** / **does not work** / **not tested**.
Evidence: link to a video or file in the shared evidence folder (not in this repository).

## Phone results 2026-11-04

Source: the owner, first run of the spike debug APK. Evidence is in the shared folder, not in this repository.

Phone: Samsung Galaxy S24 Ultra (SM-S928B), Android 16 (API 36).

| Tab | Result | Observed |
|---|---|---|
| Store | works | Reported working. Numbers still to be recorded in section 1. |
| QR | works | Scanning worked. The on-screen log printed a stale status (`denied (status not-determined)`): the log read `permission.status` right after the request, before React re-rendered. Fixed in `fix/1-spike-test-bugs`. |
| Map | **does not work** | Pressing "Download map" crashes the app (native crash, see below). |
| Go | works | Reported working. |
| Speed (stationary) | works | Tested standing still only; moving and GPS-loss cases are pending. |
| Admin (status) | works | Device status shown. Lock task, update and provisioning not reported yet. |

Layout on Android 16 (edge-to-edge): the gesture bar overlapped the bottom tab bar and the top content touched the status bar. Fixed with `react-native-safe-area-context` insets in `fix/1-spike-test-bugs`. `targetSdk` after prebuild is 36 (`react-native/gradle/libs.versions.toml`, `targetSdk = "36"`) and `edgeToEdgeEnabled=true` in the generated `gradle.properties`, so Android 16 forces edge-to-edge.

### Map crash: MapLibre native `std::regex_error`

- Trigger: "Download map" (`OfflineManager.createPack`) with the default demo style `https://demotiles.maplibre.org/style.json`. The crash comes right after `createPack` returns.
- Thread: MapLibre's `DatabaseFileSource` thread, inside `libmaplibre.so`.
- Message: `std::regex_error: The expression contained an invalid range in a {} expression`.
- It is a native abort (C++ exception), so JavaScript `try/catch` cannot catch it and the app dies.
- Status: not fixed in this PR. [ASSUMPTION] it is a bug in the MapLibre Native regex used while reading the style or tile URL for the pack (the installed `@maplibre/maplibre-react-native` 11.5.1 uses native `org.maplibre.gl:android-sdk` 13.6.1). Not verified. Next steps to isolate: try a pack with a raster style (own tile URL) and with a local style file; test with another native version; report upstream with the log. The offline map result stays "does not work" for the demo style until then. The local PMTiles mode (issue #64) does not use `OfflineManager`, so it avoids this path.

## Review notes (fix/1-spike-test-bugs)

Points for whoever reads the numbers, no code behind them:

- "Fix age" in the Speed tab is `Date.now() - location.timestamp`. The fix timestamp comes from the location provider (GNSS time or system time depending on the provider) and `Date.now()` is the system clock, so the value mixes two clocks and can be off by the clock error of the phone. Treat it as an estimate, not a latency. For a real latency use a monotonic clock on both ends.
- "Callback to overlay commit" is measured in `useLayoutEffect`, which runs after React commits the change, not after the screen paints. Add the display refresh time (about 16 ms at 60 Hz) and the GPU time for a paint figure.
- Permissions: the generated manifest (after prebuild) has no `FOREGROUND_SERVICE_LOCATION`, no `ACCESS_BACKGROUND_LOCATION` and no `RECEIVE_BOOT_COMPLETED`: `expo-location`'s config plugin only adds them when background location or the foreground service are enabled (`plugin/build/withLocation.js`), and this app enables neither. The library manifest declares two services with `foregroundServiceType="location"`; that is harmless without starting them. `SYSTEM_ALERT_WINDOW` is in the generated manifest too; it comes from the Expo template, nothing in the spike needs it. [ASSUMPTION] check the merged manifest of the built APK (`aapt dump permissions`) and block it before any production build.
- Android 11+ package visibility: `getPackageInfo("app.organicmaps")` needs a `<queries>` entry or it reports "not installed" for an installed app. The first build had none, so a "not installed" result in the Go tab on that build may be wrong. Added with a config plugin; repeat the Go tests on the new build.
- Lock task after update or reboot: chosen `android:lockTaskMode="if_whitelisted"` on `MainActivity` (config plugin) over `startLockTask()` on mount. Reason: the Android docs offer it for "automatically run your activity in lock task mode" and warn not to start lock task while the device is locked, which a mount-time call cannot check cleanly. Source: https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode. It does not make the app start by itself after a reboot (that needs the app to be the home app); it applies when the activity is launched, for example by the post-update relaunch receiver.
- Kotlin long operations: in `expo-modules-core` (`AppContext.kt`) a plain `AsyncFunction` runs on one `HandlerThread` queue ("expo.modules.AsyncFunctionQueue"), so a long download blocks every other async call. Download, install and discard now use the `Coroutine` variant of `AsyncFunction` with `withContext(Dispatchers.IO)`. The Expo docs page (https://docs.expo.dev/modules/module-api/) shows the `Coroutine` syntax but does not say which dispatcher it uses by default, hence the explicit `Dispatchers.IO`.
- Store fairness: both stores now index only `status` (WatermelonDB `isIndexed` on `status`; op-sqlite had an extra composite index) and both request `journal_mode=WAL`, `synchronous=FULL`; the values actually in effect are logged when each store opens. [ASSUMPTION] reading PRAGMAs through `Q.unsafeSqlQuery` works on WatermelonDB's Android async bridge; if not, the log line says so.
- WatermelonDB Android async mode: no PRAGMA is set by the native Android code (`WMDatabase.java`); WAL + FULL are only in the JSI C++ code. Compare the logged values before comparing timings.

## 0. Test phones and build

| Id | Phone model | Android version | Security patch | Free storage at start | Google services (yes/no) | Notes |
|---|---|---|---|---|---|---|
| P1 | | | | | | |
| P2 | | | | | | |

Build used: commit `____`, React Native 0.88.1, Expo SDK 58 (from `package.json`), JDK used `____`, build date `____`.

Build problems (first Gradle error, what fixed it):

| Problem | Fix |
|---|---|
| | |

## 1. Local store: WatermelonDB vs op-sqlite

Same steps for both (README 5.1). Times in ms.

| Phone | Library | Dispatcher (async / jsi) | Write 10k (one batch) | 200 single writes: mean / p95 / max | Read pending (100) | Count pending | Count all | Rows found after app kill (expected = rows before) | Result | Evidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | op-sqlite | | | | | | | | | | |
| | WatermelonDB | | | | | | | | | | |

Questions to answer:

- Did any row get lost after force-stop? (yes / no, count) ____
- Did WatermelonDB JSI mode load? If not, the numbers above are async-bridge numbers. ____
- Build / install friction with each library on React Native 0.88 (New Architecture only): ____
- APK size added by each library (optional): ____

### 1.1 Recommendation: local store library

Chosen: `____`

Reasons (numbers first, then maintenance, API fit with the outbox in issue #6, sync helpers, team familiarity):

1.
2.
3.

Risks and what we do about them:

-

## 2. QR scanning (VisionCamera + ML Kit barcode scanner)

| Phone | Condition | Reads out of attempts | Median time to first read (ms) | Result | Evidence | Notes |
|---|---|---|---|---|---|---|
| | Indoor, good label | | | | | |
| | Sunlight, good label | | | | | |
| | Sunlight, torch on | | | | | |
| | Shade / low light, torch off | | | | | |
| | Damaged label (scratched) | | | | | |
| | Damaged label (folded / half covered) | | | | | |
| | Small code (size ____ mm) | | | | | |

Answer: is read speed acceptable in sunlight? ____ Does the torch work on every test phone? ____
Needs Google Play services? (tested on a phone without them: yes / no / not tested) ____

## 3. Offline map (MapLibre)

Tile source used: `____` (demo style / own server / provider). Does its license allow offline use? ____
The OSM tile server policy forbids offline use and pre-seeding (`operations.osmfoundation.org/policies/tiles/`), so it was not used. Decision needed from the client: where do tiles come from? ____

| Phone | Area (W,S,E,N) | Zoom range | Tiles | Pack size | Download time | Render time online | Render time offline (airplane, after app kill) | Behavior outside the pack | Result | Evidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | |

Estimate for one real operating quadrant (area ____ km2, zoom ____ to ____): ____ MB. Method: ____

Attribution displayed correctly? ____

## 4. How to get there (Organic Maps via `geo:`)

| Phone | Organic Maps installed | Button | Behavior | Returns to app with Back | Result | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| | yes | Open in Organic Maps | | | | | |
| | no | Open in Organic Maps | | | | | |
| | no | Open with any map app | | | | | |
| | yes, lock task ON, in allowlist | Open in Organic Maps | | | | | |
| | yes, lock task ON, NOT in allowlist | Open in Organic Maps | | | | | |

Organic Maps version tested: ____. Decision for the "not installed" case (message text and next step): ____

## 5. Speed lock

Threshold in the PoC: 10 km/h (default of a rule parameter).

| Phone | Scenario | Real speed | App speed | Overlay shown correctly | Fix age at callback (ms) | Callback to overlay layout (ms) | Result | Evidence | Notes |
|---|---|---|---|---|---|---|---|---|---|
| | Walking | | | | | | | | |
| | Motorbike / car, above threshold | | | | | | | | |
| | Slowing below threshold (hide) | | | | | | | | |
| | Stopped at a light | | | | | | | | |

Answers: Latency to show the overlay (typical / worst): ____ . False positives while walking or stopped: ____ . Is hysteresis or a minimum duration needed? ____

## 6. Dedicated mode (Device Owner and lock task)

| Phone | Provisioning method | Command output / error | Is Device Owner after | Lock task works (home, recents, notifications hidden) | Still reachable by the user | State after reboot | Starts by itself after reboot | Result | Evidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| | adb `dpm set-device-owner` | | | | | | | | | |
| | QR at first boot (if tried) | | | | | | | | | |

Per phone model, what had to be done differently (accounts, OEM switches, USB debugging variants): ____

Is being the home app (`addPersistentPreferredActivity`) needed so the app returns after reboot? ____

## 7. Server-driven update

### 7.1 APK update from inside the app

| Phone | Device Owner | Download size | Download time | SHA-256 check | Confirmation screen shown | Install time | App restarted by itself | Back in lock task | Version after | Result | Evidence | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | yes | | | | | | | | | | | |
| | no | | | | | | | | | | | |

### 7.2 Edge: update download interrupted

| Phone | How interrupted | Server supports Range | Resumed or restarted | Final result | Evidence | Notes |
|---|---|---|---|---|---|---|
| | airplane mode at ~50 % | | | | | |
| | kill the app mid-download | | | | | |
| | wrong SHA-256 | n/a | n/a | | | |

### 7.3 JS-only OTA (alternative, documentation only)

Evaluated? ____. Notes on runtime version limits, hosting, and whether it is worth adding on top of APK updates: ____

## 8. Edge cases from the issue

| Case | Phone | What was done | Expected | Observed | Result | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Reboot with pending queue | | Store rows, `adb reboot`, reopen | Same row count | | | | |
| Storage almost full: event writes | | Fill phone, Store step 1 | Readable error, no crash, no partial data | | | | |
| Storage almost full: map pack | | Fill phone, download pack | Readable error | | | | |
| Storage almost full: APK download | | Fill phone, download | "Not enough free storage" before download | | | | |
| GPS off | | Location off, Speed tab | App knows GPS is off | | | | |
| GPS weak accuracy | | Indoors | Accuracy shown, no wrong lock | | | | |
| Camera permission denied | | Deny, deny forever | Clear message, "Open app settings" works | | | | |
| Update download interrupted | | See 7.2 | Retry works or restarts cleanly | | | | |

## 9. Procedure for internal IT

To be completed from what really worked. Replace each placeholder with exact commands and screenshots.

### 9.1 Provision a phone as dedicated device

1. Prerequisites (phone models and Android versions supported): ____
2. Factory reset steps: ____
3. Setup wizard choices (accounts, Wi-Fi, language): ____
4. Enable USB debugging (per OEM): ____
5. Install the app: ____
6. Set Device Owner (command and expected output): ____
7. Verify (what to check on the phone and in the app): ____
8. Known errors and fixes: ____
9. Reverting a phone to normal: ____
10. Time per phone: ____ min. QR provisioning for scale (yes / no, why): ____

### 9.2 Publish and push an update

1. Build the new APK (versionCode must increase, same signing key): ____
2. Compute SHA-256: ____
3. Upload to the update server (hosting, https, Range support): ____
4. How the phones learn there is an update (not built in the spike): ____
5. What the field user sees during the update: ____
6. Rollback if the update is bad: ____
7. Signing key custody: ____

## 10. Conclusions

| Question from the issue | Answer | Backed by section |
|---|---|---|
| Local store library | | 1 |
| QR scanning viable (speed, torch, damaged labels) | | 2 |
| Offline map viable (size, render time) and tile source | | 3 |
| "How to get there" with Organic Maps | | 4 |
| Speed lock viable | | 5 |
| Dedicated mode viable | | 6 |
| In-app APK update viable | | 7 |

Escalations before epic #8 (issue notes: if dedicated mode or in-app updates are not feasible): ____

Updates to make in `docs/decisions.md`:

- Row 6 (internal distribution, dedicated mode, server-driven updates): new status ____ . Mechanism: ____
- Row 7 (local DB library, QR library, MapLibre offline tiles): new status ____ . Choices: ____
