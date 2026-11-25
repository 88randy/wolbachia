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
| `day-end.ts` | Pure: the first local day end after the shift opening in an IANA zone (DST-aware, `Intl`). |
| `track-store.ts` | `track_point` (schema25), the cut into <= 250-position segments and the 30-day pruning. |
| `use-own-track.ts`, `TrackNoticeBanner.tsx`, `maps/MapTrackLine.tsx` | P10 line from local points (offline) and the non-blocking notice. |

## Rules that make the races impossible

- One queue (`TrackRecorder.#serial`) runs every append, cut, start and stop: a cut never races an append.
- A cut inserts its events and stamps `segment_event_id` in ONE transaction; a point is unsent or carried by exactly one event.
- Segments are inserted as late captures (`isLateCapture`): a cut after the local close is valid when its last position is not after the close. Points after the close are deleted, never sent.
- The first owner that tracks a shift claims it (`kv` `track_shift_owner:<shift>`); the open-shift read filters by that claim, so points never carry another owner's shift.
- The task callback re-reads the open shift and owner. A deferred batch (up to 60 s) that arrives after the local close still records its fixes up to the close into the owner's last claimed shift and cuts them; anything else outside an open shift of the same owner is discarded.
- Retention (decision 175): after 30 days the phone deletes points whose event has a final answer (`sent`, `in_review`, `rejected`) and compacts those `track.segment` payloads to `{started_at, positions: [], compacted: true}`. The envelope trigger allows only that change on a final segment; a final event is never resent. Unsent points and pending events stay whole and also count as local records for owner binding.
- Session changes (login, unlock, profile hydration, logout, revocation, owner change) and every foreground run `reconcile`, so a cold start that hydrates late still resumes tracking.
- Day end (#371, owner decision 2026-11-25): a shift left open stops recording at the first `track_day_end_minutes` after its opening, in the organization's time zone (`day-end.ts`; the device zone if unknown). The recorder flushes the last segment, stops the service, drops fixes after the day end and shows "Your shift is still open. Close it to end your day." on P10. The same shift is never recorded again, not even the next day; only a shift opened afterwards records. The shift itself is never closed automatically. No system notification (no notifications library in the app): the stopped service removes its own.
- Idle batching (#371): moving points (any pair kept less than a heartbeat apart) are cut every `track_upload_interval_seconds`; heartbeat-only points wait until the oldest is `IDLE_CUT_MS` (60 min) old. A still hour is one `track.segment` of ~12 positions instead of twelve events of one, so fewer outbox rows and fewer sync wake-ups. Close, logout, revocation and day end still flush everything.
- The notification text is read when the service starts; a language change shows in it from the next start (restarting a foreground service from a settings change is not worth the risk).

## Parameters (rule snapshot `auth_rules_snapshot`, seed defaults and bounds)

`track_sample_interval_seconds` 15 (5..300), `track_min_move_m` 15 (1..200),
`track_still_heartbeat_seconds` 300 (60..3600), `track_upload_interval_seconds` 300 (60..3600),
`track_simplify_tolerance_m` 5 (0..50), `track_high_accuracy` 0 (Balanced; 1 = High),
`track_day_end_minutes` 1200 = 20:00 local (600..1439).
Native options: `distanceInterval` 0 (the filter is in JS so a still phone keeps reporting) and
`deferredUpdatesInterval` 60 s (one JS wake-up per minute while the app is paused).

## Not verified here

Node tests drive an injected native API. Battery (`adb shell dumpsys batterystats`, 8-hour shift,
screen off, Balanced), OEM service killing, the notification on Android 13+, the task running with
the encrypted database while the app is paused, and the P10 line render need the milestone APK.
