# Day projections and task locations

## Fuel capture context (#140)

`withFuelContext` reuses the same short projection writer and downloaded paired
capture context. Its original raw context/profile guard pins owner, session,
scope/authority revisions and `field_event.sync`; upload permission is separate.
The operational shift pins the motorcycle code. This reader neither invents a
motorcycle-to-center mapping nor adds a fuel baseline producer. Exact B05 shift
and B04 parent authority are still rechecked by the server.

## Courier supply projection (#134)

The same DayStore transaction also publishes the actual `supplies` section into
private KV cache rows. Full replacement binds readiness to the proven owner,
session and capture scope revision; a missing section, legacy ETag/cursor or delta
cannot hydrate this new consumer. Production refresh omits its ETag until a full
body commits. Recovery suspends readiness, and revocation removes only these
downloaded rows. Authored receipt drafts, evidence and outbox events remain owned
by their existing local writers.

Supply deltas use the canonical sequence and opaque resource version. A valid
envelope with an unreadable body invalidates that assignment; older deltas cannot
restore it. Invalid envelopes reject the whole transaction. Generated B10 DTOs
retain decimal text and exact assignment/release/receipt UUIDs. Current projection
replacement never rewrites a draft's captured original plan.

`withSupplyAssignments` shares the existing short projection gate and original
transport identity. It requires current owner/session/capture readiness, own
assignment identity, an explicit paired sync grant, and current session-profile
receive/upload codes. It returns a SQL predicate comparing all raw source rows;
the receipt writer must assert that predicate inside its atomic draft/outbox write.
The current backend context does not expose per-action grant pairs, human lot codes
or unit labels. These are not reconstructed from display data; the server remains
the final authority for each received source and its current receive/upload scope.

`supply-projections.test.ts` owns strict custody parsing, new-consumer hydration,
malformed delta invalidation, action-code denial and stale original-source CAS.
These ordinary SQLite tests do not establish native cold-start or device evidence.

`DayStore` owns downloaded day projections. Bootstrap replaces its sampling-point
cache in the same SQLite transaction as assignments, manifests, metadata and the
cursor. Deltas use the existing bundle/sync writer gate and transaction. Revoking
downloads deletes the point cache with the other day projections; it preserves
the existing immutable outbox and capture evidence.

## Existing wire relationship (#221)

### Lifecycle context checkpoint (#138 M2)

The same DayStore transaction now owns history3/quadrant2 and private lifecycle
context/readiness KV state. It consumes actual capture_context1 under an optional
already-proven EvidenceIdentity from DayBundleService. Production createServices now forwards acceptedEvidenceOwner through createDayBundle. Me/display scope, task rows and DTO self UUIDs never prove that identity.

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

### Known invalid-cursor recovery (#138 M4)

`recoverProjections` first suspends capture readiness in the original short writer,
using its original durable revision CAS. The same transaction advances authority,
records the predecessor, marks full-body recovery pending and invalidates attachment
admission. It preserves downloaded caches, true M08 Assignment/supply context,
immutable owned facts, drafts, events, evidence and the old cursor. Recovery then
continues only from that confirmed successor under the same transport identity;
it never captures a replacement owner after an await.

This is an explicit recovery transition, not an ordinary refresh or network error.
A normal offline refresh preserves a still-valid context. Once an invalid cursor
is observed, failed HTTP, unexpected304 and cold reopen retain pending readiness.
Only a committed complete bootstrap body may hydrate it again; stale configuration
or capture writers fail inside SQL. Projection publication and receipt/cursor
settlement remain separate, and final JSON receipts still precede full cleanup.

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

### Private lifecycle source turn (#138 M3)

captureLifecycleSource captures its original transport before awaits and reads real
point/physical/epoch/config context under this SAME writer. The returned consumer
runs outside BOTH the short projection gate and the network queue. Slow/native/HTTP
work never owns either gate. Only a local commit enters credentials → original
projection writer → SQLite with original interactive/owner/session/generation and
durable revision checks. No task/Assignment/Me permission reconstruction exists.
Downloaded and owned-local physical provenance stay distinct. Legacy decoding is
not ownership; service display hides private data without current proven owned facts.
The detailed protocol and remaining M4/M5/native limits live in lifecycle/README.md.

## M09 final transport and task read (#138 M5)

The pure create-day-bundle factory is the actual app factory, reexported by create-day.
Active scope remains required for bootstrap/capture/read. A separate retained
issuer/session transport fence permits ended-session final JSON retry after restart
without giving an EvidenceOwner/unlock/read grant. Receipt settlement precedes
projection cleanup; an old cleanup cannot clear a replacement session's cache.
Current-task navigation and lifecycle feedback share current-task.ts: exact UUID,
point, proven courier, removed=false and explicit v3 isCompleted=false only.
No retained payload or point-code fallback creates an action or capture permission.
