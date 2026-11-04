# Mobile foundations spike: REPORT

Issue: #1. How to run each test: `README.md` in this folder.
Status: **TEMPLATE, values blank.** The owner fills this in after testing on real company phones.

Result scale: **works** / **works with caveats** / **does not work** / **not tested**.
Evidence: link to a video or file in the shared evidence folder (not in this repository).

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
