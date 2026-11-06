# Geography decisions (B33 / issue126)

Read ../README.md, ../../ovitraps/lifecycle/README.md, ../../reviews/README.md,
../../scheduling/README.md and ../../../docs/sync.md first.

Own relocation decisions, real next-day task provenance, third-party intervention
metadata and immutable quadrant-epoch closure. Reuse existing RelocationDecision,
PointVersion, ScheduledTask, current paired scope,113 original proof/effect receipt
and ONE typed courier history. No source rewrite, geometry reopen, fake task
assignment, new event queue or release authority. Intervention read/create are
separate permissions. OP03 markers belong to B15, not general Incident104.

## Decision and intervention contracts

POST /relocations/{id}/approve/ or reject/ consumes reason and expected_revision=0.
One terminal decision wins; a retry returns409. Approval validates the current
point revision/geometry and returns the exact next PointVersion of the same fixed
code. relocation.decide never implies sampling_point.create. Rejection links one
real check ScheduledTask on the next organization-local day of one decided_at anchor.
Discovery, PointVersion.effective_from, task date, SQL guard and history share that
server instant across midnight. created_at remains the actual insert audit time;
legacy decided_at stays unknown/null without inference or backfill.
An existing task keeps its owner/provenance; a new task uses the due-day assignment
and current field scope, or remains unassigned. NextDayTask records the unique
proposal/decision origin. The existing v3 assignment producer publishes owned tasks.

GET /third-party-interventions/ requires intervention.read; POST requires
intervention.create for every actual block's paired center/quadrant. Foreign or
mixed ungranted references are404. Filters type/block/date overlap and ordering
created_at/date_from/date_to run before page-number pagination. This UUID resource
has no code filter. Snapshot intervention-type, require Other text, nonblank bounded
product/source and ordered ISO dates. No invented biological date window or release
authority is inferred. Defaults use existing once-only bookkeeping: admin/supervisor
get all four new actions; entomologist gets intervention.read/create (W32). All other
profiles, including coordinator/government, get none. Custom/revoked grants survive.

## Closure, historical proof and publication

GET /quadrants/{id}/closure/ is observational under quadrant.close. POST close/
rechecks the exact QuadrantVersion.revision under Organization. Each deployed live
physical identity, unresolved false-recovery removal, pending effective relocation,
pending removal/relocation review without effects and actual104 owned
IncidentBlocker(kind=quadrant_closure) blocks close. #217 clears only its removal;
#104 clears only its incident. Hidden references coalesce to an opaque action.
QuadrantClosure appends one epoch audit without retiring geometry, clearing tasks
or rewriting sources. Explicit QuadrantVersion publication is the existing new-work
path. Schedule generation skips the closed current epoch. Removal/replacement void
cannot invalidate a retirement/lineage fact that the closure actually consumed.
The same materialized effective113 retirement selection supplies readiness and its
internal immutable causal snapshot; no dependency is inferred from device_time or
an old epoch. A historical retirement accepted after close is not retroactively a
closure dependency. Missing/unsupported snapshot proof fails closed for that actual
quadrant without inventing an epoch. Raw guards bind exact causal facts. The public
closure DTO exposes epoch/revision/actor/time, never the private snapshot/source IDs.

The existing quadrants producer advances to schema2. Current quadrant references
include is_closed/closure_id from the exact published epoch; block references keep
their distinct six-field shape. Bootstrap and atomic close upserts use the same
builder, with an opaque quadrant content-hash resource_version (payload.revision
remains the geography revision). Closure and publication roll back together.
All actual download recipients are planned/locked before Organization. Retained
canonical six-field changes remain six-field history without fabricated open flags;
schema invalidation obtains the current full bootstrap. A new explicit epoch emits
its own open reference without changing the old closure. No mobile UI or offline
consumption of these fields is implemented or certified here.

capture_context retains actual selected point/rules/version IDs/speed reference
BEFORE the closure signal and BEFORE operational effects. The same owner records
captured epoch/assignment/closure identity. First delivery of preclosure capture
after close enters late_work_after_quadrant_close review; captured-at equality or
later enters captured_after_quadrant_close with0 effects and no acceptance bypass.
Only the former is reviewable through OvitrapReviewAdapter and original113 proof.
Missing original facts remain blocked even when current grants allow work.
Historical application appends permitted operational facts once via the existing
owner/ReviewEffectReceipt, without a new task, epoch or reopening. Both source clocks,
envelope, ingest result, evidence and rule/catalog provenance remain immutable.

History schema2 extends the single113 producer with a discriminated
relocation_proposal branch and real decision/task links. Publication occurs after
the actual source/effect exists; HistoryPublicationReceipt is not delivery proof.
Current complete subject visibility filters before LIMIT and bootstrap. Existing
cursor invalidation/bootstrap replacement handles revocation; task delivery follows
its real owner. OP03's fixed-point OvitrapIncidentLink counter is unchanged, without
an extra time window or general104 Incident authority. Mobile138 advisory work is
outside this issue.

Preauthorize/preread identities, then sorted Users -> current Device/Session/Pair
-> sorted source FieldEvents -> Organization NO KEY UPDATE NOWAIT -> sorted courier
TRY locks -> geography/tasks -> uploads where the existing review owner needs them.
New recipients cause retry, never late identity locks. No external I/O under locks.
Busy arbitration is429; stale/blocked state409. Failure rolls back all new effects.

New migrations preserve legacy rows and unknown nullable decision audit fields;
no invented reasons/authors/tasks or destructive backfill. Unique terminal/effect
links, INSERT provenance guards, deferred complete point/task/history publication,
required real intervention blocks and raw UPDATE/DELETE guards preserve new facts.
Reverse migration refuses when it would lose retained B33 audit. The criterion map
lives in the ignored delivery packet and the tests named test_geography_*_b_33 and
test_history_contract_b_33. Existing113/B15/217/104/scheduling regressions remain.

The implementation ledger/ADR proposal and offline connection-denial harness are
ignored under backend/.pytest_cache/issue-126. Local PostgreSQL/HTTP/concurrency
and migration execution remain UNRUN; root's later PostgreSQL CI is mandatory.
