TITLE: [Backend+Mobile+Web] Courier track: record the day track during an open shift and show it on P10, W28 and W29
LABELS: (none on GitHub)

### 1. Context
The owner (2026-11-24) wants the courier's current position as a dot on the map and the day track recorded during the workday, like Google Timeline, without draining the battery. Today the phone reads location only in the foreground (`create-android-location.ts`, Balanced watch; a parallel change moves it to high accuracy with hysteresis) and nothing is stored or uploaded. W28 (`/operations/live`) lists open shifts every 30 s but shows only quadrants. B-16/#19 planned a per-fix `location.ping` event plus a WebSocket; neither exists. Owner decisions: visible on the phone (own dot + own day track on P10 "Mapa del día") and on the web (supervisor sees each courier's current position and day track; history by day); the server keeps tracks forever (nothing is deleted); the phone keeps only the last 30 days; tracking only during an open shift, never outside it.

### 2. Goal
While a shift is open, the phone records a battery-friendly, simplified track, uploads it through the existing offline-first sync as idempotent `track.segment` events, and shows it on P10. Authorized web users see the last position of every readable open shift on W28 and the full track of any readable shift on W28 (focused courier) and W29.

### 3. Scope / Out of scope
**In:**
- Backend: `tracks` app with insert-only `TrackSegment`, `track.segment` schema 1 handler, `GET /api/v1/shifts/positions/`, `GET /api/v1/shifts/{id}/track/`, permission `courier_track.read`, insert-only view receipts, rule parameters for sampling, docs and generated client.
- Mobile: background capture with an Android location foreground service only between local shift open and close; filter, stillness heartbeat, Douglas-Peucker simplification, 5-minute segments into the existing outbox; local `track_point` table pruned to 30 days; own track line on P10.
- Web: last-position dots and focused-courier track on W28; shift track on W29.

**Out:**
- WebSocket push (#19 stays as the follow-up; it will read `TrackSegment`).
- Road snapping, distance/speed statistics, stop detection reports, exports (`/export/`) of tracks.
- iOS, `ACCESS_BACKGROUND_LOCATION`, tracking after process death or reboot (resumes when the app opens and the shift is still open).
- Server-side retention or deletion (kept forever by decision).
- Changing `create-android-location.ts` / `SharedLocationSource` (owned by the parallel change).

### 4. Data model
Backend, new app `backend/tracks/` (registered from `AppConfig.ready()`, imports `shifts`; `field_sync` never imports it):

`TrackSegment(ImmutableMixin, OrgScopedModel)` — insert-only (model, manager and the same raw UPDATE/DELETE trigger pattern used by `FieldEvent`):
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | server default |
| `organization` | FK | from `OrgScopedModel` |
| `field_event` | OneToOne `field_sync.FieldEvent`, PROTECT | the accepted `track.segment` source; gives `device_time` and `server_received_at` (double time) |
| `shift` | FK `shifts.Shift`, PROTECT | |
| `courier` | FK `accounts.User`, PROTECT | = `shift.courier` |
| `started_at_device` | datetime | first kept position |
| `ended_at_device` | datetime | last kept position |
| `position_count` | positive smallint | 1..250 |
| `positions` | JSONField | `[[offset_s, lat, lng, accuracy_m], ...]`, offsets from `started_at_device`, non-decreasing |
| `trimmed_count` | positive smallint | positions dropped by the server because they fall outside the shift window |

Indexes (created with the table, so no `CONCURRENTLY` is needed): `(shift, ended_at_device)` for last position, `(organization, courier, started_at_device)` for history. No partitioning (volume in the plan, section 3).

`TrackViewReceipt(ImmutableMixin, OrgScopedModel)` — insert-only: `viewer` FK User, `shift` FK Shift (nullable for the live list), `kind` (`live` | `track`), `hour` (datetime truncated to the hour, UTC). Unique `(viewer, kind, shift, hour)`; written with `bulk_create(ignore_conflicts=True)` so 30-second polling stores at most one receipt per viewer, kind, shift and hour.

Rule parameters (existing `rules` registry, delivered to the phone with the rules snapshot; defaults documented, client may change them):
| Key | Default | Meaning |
|---|---|---|
| `track_sample_interval_seconds` | 15 | native `timeInterval` |
| `track_min_move_m` | 15 | minimum move to keep a fix (also floored by the fix accuracy) |
| `track_still_heartbeat_seconds` | 300 | one kept fix per interval while still |
| `track_upload_interval_seconds` | 300 | segment cut cadence |
| `track_simplify_tolerance_m` | 5 | Douglas-Peucker epsilon |
| `track_high_accuracy` | false | `Accuracy.High` instead of `Balanced` for the background task |

Mobile: additive SQLite migration after the current `SCHEMA_VERSION` (never edit released SQL; check lineage, lesson #266):
`track_point(id INTEGER PK, owner_user_id TEXT, shift_id TEXT, recorded_at INTEGER, lat REAL, lng REAL, accuracy_m REAL, segment_event_id TEXT NULL)`, indexes `(shift_id, recorded_at)` and `(recorded_at)`.

### 5. Contract (API / interfaces)
**Sync event** `track.segment`, schema 1 (new row in `docs/sync.md`):
- Envelope: client UUID `id`, `shift_id` required, `device_time` = time of the last position.
- Payload: `{ "started_at": "<ISO-8601 device time>", "positions": [[offset_s, lat, lng, accuracy_m], ...] }`.
- Validation: 1..250 positions; `offset_s` integer ≥ 0, non-decreasing, span ≤ 86 400; `lat` ∈ [-90, 90], `lng` ∈ [-180, 180], 6 decimals max; `accuracy_m` integer 0..5000; finite numbers only. Fails → `rejected invalid_payload`.
- Handler: `checks_shift=False` (own check, see Behavior). Codes reused: `shift_not_open` (rejected). No new result codes.

**REST** (actions on `ShiftViewSet`, `required_permissions = courier_track.read`, scope through `readable_shifts`):
- `GET /api/v1/shifts/positions/` → `[{shift_id, shift_code, courier, motorcycle_code, lat, lng, accuracy_m, recorded_at, received_at}]` for readable **open** shifts that have at least one segment. No paging (bounded by open shifts). Shifts without segments are absent (W28 shows "no position yet").
- `GET /api/v1/shifts/{id}/track/` → `{shift_id, status, segments: [{id, started_at, ended_at, received_at, positions: [[offset_s, lat, lng, accuracy_m]]}], pending_review_count}` ordered by `started_at`. Voided sources are excluded. `pending_review_count` = `track.segment` events of the shift stored `in_review`. Unknown, foreign or out-of-scope id → `404`.
- Both write a `TrackViewReceipt` (deduplicated per hour). No text for users; codes only.
- `GET /api/v1/me/` exposes `courier_track.read` like any permission.
- Regenerate `packages/api-client`; document in `docs/api-conventions.md`.

**Mobile interfaces:** `TrackRecorder` (start(shift), stop(), isRunning), task name `wolbachia-courier-track` defined at module scope; `simplifyTrack(points, toleranceM)` pure function; `TrackStore` (append, cutSegment → outbox in the same transaction, listForShift, pruneOlderThan).

### 6. Behavior
Phone:
1. On local shift open (app in foreground): request `POST_NOTIFICATIONS` (Android 13+) if missing, then `Location.startLocationUpdatesAsync(TASK, { accuracy: Balanced|High, timeInterval: 15 000, distanceInterval: 0, deferredUpdatesInterval: 60 000, foregroundService: { notificationTitle, notificationBody (i18n), killServiceOnDestroy: true } })`.
2. The task callback discards everything if there is no open local shift or the owner changed. Otherwise it keeps a fix only if `accuracy_m ≤ 100` and it moved ≥ `max(track_min_move_m, accuracy_m)` from the last kept fix, or `track_still_heartbeat_seconds` passed since the last kept fix.
3. Every `track_upload_interval_seconds` (and on shift close): take unsent points, simplify with Douglas-Peucker (keep first, last and heartbeat points), split into chunks of ≤ 250, and in one SQLite transaction enqueue `track.segment` events and stamp `segment_event_id`. Then `engine.requestSync()`.
4. On local shift close (also offline), logout, session revocation or owner change: flush the last segment, then `stopLocationUpdatesAsync`. On app start: if the task is registered and there is no open local shift → stop; if there is an open shift and the task is not running → start.
5. P10 draws the current shift's local points as a line (plus the existing own dot). Works offline.
6. Pruning on app start and on shift open: delete `track_point` rows older than 30 days **only** when their `segment_event_id` has a final outbox result (accepted, in_review or rejected). Unsent points are never pruned.

Server:
7. Handler checks the shift exists, belongs to the organization and to the sender (else `shift_not_open`), drops positions before `opened_at_device` or after `closed_at_device` (counted in `trimmed_count`); if none remain the event is `accepted` with no segment row. Writes one `TrackSegment` inside the pipeline savepoint. Clock-skew or final-upload batches are `in_review`: no segment (decision 73) and they count in `pending_review_count`.
8. A motorcycle safety hold does **not** hide the track (tracks are observations, not operational effects); that is why `checks_shift=False`.

Web:
9. W28 polls `/shifts/positions/` with the existing 30-second interval and draws one dot per courier: icon + name label; positions older than `2 × track_upload_interval_seconds` are drawn hollow with "hace N min" (never color alone). Focusing a courier (`?courier=`) loads that shift's track once and refreshes it every 2 minutes.
10. W29 shows the shift's track on a map with start/end markers and the equivalent data table (segment start, end, positions). History by day = existing `/operations/shifts?courier=&date_from=&date_to=`.
11. Without `courier_track.read`: no dots, no track, no map toggle (hidden, not disabled).

### 7. Edge cases and errors
- Location or notification permission denied, GPS off: shift still opens (tracking never blocks work); the phone shows a non-blocking notice; no segments are sent.
- App killed or phone rebooted mid-shift: gap in the track; resumes on next app open while the shift is open. Documented, not hidden.
- Android refuses the foreground service (`ForegroundServiceStartNotAllowedException`): log with context, retry on next foreground.
- Offline all day: points stay local; segments sync later; server accepts late segments whose positions fall inside the shift window.
- Segment captured after the server saw the close: positions after `closed_at_device` are trimmed, not reviewed.
- Duplicate or retried upload: idempotent by event id.
- Payload over 16 KB: impossible at 250 positions (~10 KB); still `event_payload_too_large` if it happens.
- Clock skew batch: segments `in_review`, not drawn; W29 shows "N tramos en revisión".
- Courier with two phones: both upload; segments overlap; drawn as is (rare, out of scope to merge).
- Another organization's shift id: `404` / `shift_not_open`, no leak.
- Voided `track.segment` (generic `record.void`): excluded from reads; the phone never sends it.

### 8. Acceptance criteria
- [ ] `track.segment` valid payload creates exactly one `TrackSegment`; replay creates nothing (`test_track_segment_is_idempotent`).
- [ ] Foreign/other-courier shift → `shift_not_open`; positions outside the shift window are trimmed (`test_track_segment_trims_outside_shift_window`).
- [ ] Clock-skew batch stores `in_review` without a segment and counts in `pending_review_count`.
- [ ] Invalid payloads (251 positions, decreasing offsets, out-of-range lat/lng, NaN) → `invalid_payload`.
- [ ] `TrackSegment` and `TrackViewReceipt` refuse UPDATE/DELETE (ORM and raw SQL).
- [ ] `/shifts/positions/` returns only readable open shifts; another organization or center → absent; no permission → `403`.
- [ ] `/shifts/{id}/track/` returns ordered segments; foreign or out-of-scope → `404`; one receipt per viewer/kind/shift/hour under repeated calls.
- [ ] Phone: tracking task starts only with an open local shift and stops on close, logout and revocation, also offline (unit tests with injected native API).
- [ ] Phone: stillness keeps one fix per heartbeat; Douglas-Peucker keeps first/last and respects the tolerance (pure tests).
- [ ] Phone: segment enqueue and `segment_event_id` stamping are atomic; pruning never deletes unsent points or points newer than 30 days.
- [ ] P10 shows the own line offline; W28 shows dots with icon + label + age, hollow when stale; W29 shows the track plus its data table; both hidden without permission; keyboard and contrast pass (WCAG 2.2 AA).
- [ ] Device check (milestone APK): 8-hour shift with screen mostly off, Balanced profile: tracking overhead measured with `adb shell dumpsys batterystats` and reported in the PR (target ≤ 10 % of battery, [PENDING] measurement).
- [ ] `docs/sync.md`, `docs/api-conventions.md`, `docs/glossary.md`, `docs/decisions.md`, folder READMEs and `packages/api-client` updated; CI green.

### Notes
- Supersedes the `location.ping` part of B-16/#19 and decision 68; #19 keeps the WebSocket and must read `TrackSegment`. Add a decision row.
- Glossary rows: recorrido → courier track (`TrackSegment`, `track.segment`); posición actual → last position (`/shifts/positions/`). Do not use `location` (inventory) or `route` (P9).
- [ASSUMPTION] Fused Location Provider merges the Balanced background request with the high-accuracy foreground watch, so the track gets GPS-quality fixes while the screen is on at no extra cost. Verify on device.
- [ASSUMPTION] Battery figures in the plan are estimates; only the device measurement counts.
- [PENDING client] Whether viewing tracks needs a legal notice to couriers (LFPDPPP privacy notice). Default: receipts on, notice text owned by the client.
- New dependency: `expo-task-manager` (SDK 58 version via `npx expo install`); reason: `defineLocationTask`/`TaskManager.defineTask` is the only delivery path for background updates in `expo-location` (verified: `LocationUpdatesHandle.js` throws without it). Maintained by Expo.
