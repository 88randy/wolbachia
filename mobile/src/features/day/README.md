# Day projections and task locations

`DayStore` owns downloaded day projections. Bootstrap replaces its sampling-point
cache in the same SQLite transaction as assignments, manifests, metadata and the
cursor. Deltas use the existing bundle/sync writer gate and transaction. Revoking
downloads deletes the point cache with the other day projections; it preserves
the existing immutable outbox and capture evidence.

## Existing wire relationship (#221)

### Lifecycle context checkpoint (#138 M2)

The same DayStore transaction now owns history3/quadrant2 and private lifecycle
context/readiness KV state. It consumes actual capture_context1 under an optional
already-proven EvidenceIdentity from DayBundleService. The production port wiring
remains M3. Me/display scope, task rows and DTO self UUIDs never prove that identity.

Only complete committed full replacement hydrates the new consumer. Empty sections
and grants are meaningful denial. Missing/null/unavailable metadata narrows it;
changes can refresh only an already hydrated matching revision. Publication CAS
and confirmed predecessor continuation preserve the ORIGINAL transport fence across
pages and invalid-cursor recovery. A replacement current identity cannot rebind it.
No cursor or revision hash is ordered; no second publisher/queue/scheduler exists.

`needsBootstrap()` includes lifecycle readiness by default. DayBundleService opts
into that recovery when the private identity port is present: pending omits ETag
and unexpected304 stays an error. Callers without the port preserve legacy day-only
recovery while M09 stays unavailable; they never acknowledge its pending flag.

Revoke clears active downloads and marks quadrant/block floors unavailable, retaining
immutable owned-draft/source/reviewed-proposal facts and all recovery data. Deferred
final-session cleanup also invalidates authority durably. Sync still commits
projections BEFORE its separate receipt/cursor transaction and settles final receipts
before removing downloads. The lifecycle README and owning SQLite tests describe
failure/replay, epoch floors and ownership; these are not native qualification.

The assignments v2/v3 producer (`backend/scheduling/courier_feed.py` and
`backend/scheduling/selectors.py`) sends `task.point` as the sampling-point UUID.
It sends no coordinates. `task.code` is a task identifier that can include action
and date; it is not a safe geographic join key. Parsing normalizes `point` to
`AssignedTask.point_id` and `revision` to the string `AssignedTask.version`.
Producer v3 adds `is_completed` (#212). The parser consumes exact booleans;
absent legacy completion is UNKNOWN and a malformed present value is unreadable
(#229). Ownership revision and completion are independent.

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

## Authoritative completion and local delivery (#229)

`CachedTask.serverCompletion` comes from the current, nonremoved assignment row,
even while pending work keeps an older `retained_payload` visible. List sections,
map markers, progress and the complete-day phase share this authority: true
completes, false reopens, and absent/invalidated completion stays UNKNOWN.
Malformed task bodies with a valid envelope identity use the existing guarded
invalidation/tombstone path and unreadable notice; malformed envelopes fail before
cursor settlement. Resource-version/sequence guards remain unchanged. A void's
later false does not need a higher ownership revision.

Outbox pending/sending/error, sent, in_review and rejected states describe delivery
independently. They never complete a task or establish supervisor approval. A
pending task can show both a received capture and newer phone-only work. A later
authoritative false reopens immediately without deleting or rewriting that history.
No receipt sequence, global floor, optimistic completion or parallel queue exists.

Real M08 envelopes carry no task_id, and real v3 tasks carry no ovitrap_id.
The read-only delivery join uses the immutable captured draft's point UUID,
place/check action and capture date in its captured organization timezone, only
for a unique visible task identity. Missing/invalid origin or timezone and
ambiguous identities stay unlinked and recoverable in the outbox. Explicit
legacy task IDs keep precedence; optional legacy ovitrap/date links remain
compatibility only. No captured JSON, snapshot, evidence or envelope is repaired.
The existing conservative retained-event enrollment is unchanged; local history
does not recreate removed or revoked assignments.

Migration 11 appends after canonical 1–10 and records completion-bootstrap
readiness because old parsers may have stripped the field while preserving a
valid ETag/cursor. `needsBootstrap` checks both point and completion readiness.
Only a validated committed full replacement clears them; unexpected 304, offline,
delta sync, rollback, revocation and restart cannot acknowledge recovery. A valid
empty or legacy full bundle clears readiness once while legacy completion stays
UNKNOWN. #246 attachment-generation invalidation remains in the same projection
transactions; the file journal and existing SyncEngine transport are unchanged.

`test/task-completion.test.ts` covers strict v3/legacy parsing, same-owner true/false
content hashes and retained context, invalidation, real M08 private provenance,
ambiguous/missing-timezone delivery, review/rejected receipts, interrupted paged
sync, invalid-cursor recovery, and a schema-10 upgrade with rollback/reopen and
immutable capture/file/journal preservation. P9/P10 now say completed tasks rather
than reviewed points; this deliberate S05-Dia copy deviation distinguishes
operational completion from server review. Node SQLite does not certify native
light/dark, TalkBack, 130% font or physical-device qualification.
