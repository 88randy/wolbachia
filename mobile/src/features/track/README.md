# Courier track (#370, PR2 mobile)

While a local shift is open the phone records a battery-friendly track, shows it on P10 and uploads
it as `track.segment` schema 1 events through the existing outbox (contract: `docs/sync.md`,
"Courier track"). Nothing waits on the server; tracking never blocks work.

## Pieces

| File | Role |
| --- | --- |
| `track-task.ts` | `TaskManager.defineTask("wolbachia-courier-track")` at module scope and the Android boundary: `startLocationUpdatesAsync` with a location foreground service (`killServiceOnDestroy: true`), `POST_NOTIFICATIONS` request on Android 13+. No `ACCESS_BACKGROUND_LOCATION`: the service starts with the app in the foreground. |
| `track-recorder.ts` | One serialized queue for reconcile, fixes and cuts. `reconcile()` is the single entry for every trigger: shift open (`ShiftOpenService.onOpened`), local close (`notifyLocalClose`), logout/revocation (auth phase `login`), owner change, app start and every foreground. It reads the durable open shift and the session owner and starts or stops. |
| `track-filter.ts` | Keeps a fix only with accuracy <= 100 m and a move >= max(`track_min_move_m`, accuracy), or once per `track_still_heartbeat_seconds` while still. |
| `simplify-track.ts` | Pure Douglas-Peucker (`track_simplify_tolerance_m`); keeps first, last and points after a heartbeat-long gap. |
| `track-store.ts` | `track_point` (schema25), the cut into <= 250-position segments and the 30-day pruning. |
| `use-own-track.ts`, `TrackNoticeBanner.tsx`, `maps/MapTrackLine.tsx` | P10 line from local points (offline) and the non-blocking notice. |

## Rules that make the races impossible

- One queue (`TrackRecorder.#serial`) runs every append, cut, start and stop: a cut never races an append.
- A cut inserts its events and stamps `segment_event_id` in ONE transaction; a point is unsent or carried by exactly one event.
- Segments are inserted as late captures (`isLateCapture`): a cut after the local close is valid when its last position is not after the close. Points after the close are deleted, never sent.
- The task callback re-reads the open shift and owner; fixes of another owner or outside a shift are discarded.
- Pruning deletes only points older than 30 days whose event has a final answer (`sent`, `in_review`, `rejected`). Unsent points also count as local records for owner binding.

## Parameters (rule snapshot `auth_rules_snapshot`, seed defaults and bounds)

`track_sample_interval_seconds` 15 (5..300), `track_min_move_m` 15 (1..200),
`track_still_heartbeat_seconds` 300 (60..3600), `track_upload_interval_seconds` 300 (60..3600),
`track_simplify_tolerance_m` 5 (0..50), `track_high_accuracy` 0 (Balanced; 1 = High).
Native options: `distanceInterval` 0 (the filter is in JS so a still phone keeps reporting) and
`deferredUpdatesInterval` 60 s (one JS wake-up per minute while the app is paused).

## Not verified here

Node tests drive an injected native API. Battery (`adb shell dumpsys batterystats`, 8-hour shift,
screen off, Balanced), OEM service killing, the notification on Android 13+, the task running with
the encrypted database while the app is paused, and the P10 line render need the milestone APK.
