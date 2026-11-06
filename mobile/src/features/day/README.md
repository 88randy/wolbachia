# Day projections and task locations

`DayStore` owns downloaded day projections. Bootstrap replaces its sampling-point
cache in the same SQLite transaction as assignments, manifests, metadata and the
cursor. Deltas use the existing bundle/sync writer gate and transaction. Revoking
downloads deletes the point cache with the other day projections; it preserves
the existing immutable outbox and capture evidence.

## Existing wire relationship (#221)

The assignments v2/v3 producer (`backend/scheduling/courier_feed.py` and
`backend/scheduling/selectors.py`) sends `task.point` as the sampling-point UUID.
It sends no coordinates. `task.code` is a task identifier that can include action
and date; it is not a safe geographic join key. Parsing normalizes `point` to
`AssignedTask.point_id` and `revision` to the string `AssignedTask.version`.
Producer v3 adds `is_completed` (#212); the current mobile parser still ignores
it. Consuming that completion contract remains the separate #229 follow-up.

The existing #196 `SamplingPointBundle` carries `id`, `code`, `block_id`,
`quadrant_id`, `location: [longitude, latitude]`, `is_retired` and integer
`version`. Its producer emits `sampling_points` upserts with resource type
`sampling_point`; retirement is an upsert with `is_retired: true`, not a new
delete endpoint. No backend or generated client change is needed here.

`task-locations.ts` joins the visible task to the current point by UUID and equal
quadrant in one SQLite read. A missing, retired, invalidated, malformed or
different-quadrant point provides no coordinates. Duplicate point UUIDs in a
bootstrap are ambiguous and remain unavailable. Task codes, historical task GPS
and pending-work retention never supply a fallback location.

Migration 9 adds the point cache after the existing M-06 migrations. A valid delta
must advance both sequence and immutable point version. Malformed bodies with a
known envelope identity invalidate that point rather than preserving its old
GPS. A generic remove is accepted only as defensive invalidation by the local
projection reader; today's producer does not emit it. Bootstrap is authoritative
replacement and resets prior sequence/version floors. A malformed change
envelope rejects the existing sync transaction and does not advance its cursor.

## Upgrade readiness

An old database may retain a valid bundle ETag and sync cursor while migration 9
creates an empty point cache. Neither a conditional 304 nor valid-cursor delta
sync can establish that the complete point projection was downloaded. Migration
9 therefore records durable pending bootstrap readiness. Normal refresh uses the
existing network turn and projection writer, omits the ETag while pending and
rejects an unexpected 304. Offline errors, invalid bodies, failed SQLite writes,
delta sync, revocation and process restart cannot acknowledge readiness. Only a
successful `DayStore.replace` clears it atomically with the entire new bundle and
cursor. Existing cursor and outbox evidence survive every failed recovery. A
successful empty point section is also authoritative; cache row count is not a
readiness signal.

## Compatibility and verification

Assignments without `sampling_points` remain listed with the existing no-location
state. Optional task metadata and retained capture context remain intact. Existing
direct `NavigationPoint` callers still use their supplied coordinates; this join
only changes downloaded day-task locations. There is no production assignments
producer that supplies inline GPS on this baseline. Two M-06 fixtures previously
used it: distance ordering now supplies distinct real point UUIDs, and retention
asserts the retained task revision instead of treating historical GPS as current.

`mobile/test/task-locations.test.ts` covers the real v2/point shapes through the
existing marker and directions ports, unavailable locations, delta/version guards,
SQLite file close/reopen, scope replacement and revocation, transactional write
failure, ownership binding and normal schema 8 to 9 bootstrap recovery through
304/offline/rollback/reopen. Node SQLite evidence
does not certify Android force-stop, SQLCipher, MapLibre rendering, external
navigation handlers, TalkBack, large text or physical device profiles.
