# reviews

Issue #113 separates immutable ingest history, supervisor decisions and effective
operations. Read ../../docs/sync.md, ../../docs/api-conventions.md, ../accounts/README.md
and each concrete handler owner's README.

## Immutable facts and original inputs

ReviewItem remains the insert-only courier inbox fact; deciding never rewrites it.
ReviewSourceSnapshot pins the original envelope/hash, actual ingestion authority
observation and copied owner facts. Historical authority is separately proved from
ConfigurationRevision at device_time. Fresh /me, lazy configuration baselines and
current Motorcycle allocation cannot prove the past. Legacy FieldEvent lacks
sent_at; it is never reconstructed from rounded skew.

Future role snapshots also pin slug. Historical grants reuse the SAME pure paired
scope/government clamp as current authorization; active government excludes custom
grants and remains portal-only. An old active role snapshot without its historical
identity is authority_history_unavailable, never inferred from today's Profile.
Existing revisions are not backfilled/rewritten. Inactive roles do not clamp.

ReviewDecision appends accept/void/open_incident with expected_revision, normalized
reason and evidence IDs. is_terminal is server-derived/read-only. Acceptance has
exactly one ReviewEffectReceipt: applied_review invokes the original owner once;
adopted_legacy recognizes complete exact existing owner rows without replay or
changing their flags, clocks, values or provenance. Partial/ambiguous/unavailable
legacy blocks. Rows created under reviews.v1 without their receipt are not legacy.

Owner slots are internal versioned plain JSON copied BEFORE gates/rollback. Fuel
v1 retains actual baseline/neighbors/maximum/threshold values and versions plus
original assessment; Ovitrap v1 retains the selected PointVersion, rule values/IDs
from one statement and speed reference. The calculation consumes these same
selected values, never a second original selector. Rolled-back rows/models are
not proof. Current mandatory safety and original applicability are checked again;
changed context blocks rather than replacing original facts. Unknown causal Fuel
baseline stays unavailable, without inventing a Shift or current-config history.

Subject scope revisions and dependency resolutions append facts. Batch candidates
pin their exact envelope/hash/UUID. A declared void UUID survives independently of
its nullable real FK; later resolution never fills that old FK. Shift/void retain
original-owner rules. Physical ovitraps may be shared through actual current and
historical scope, never tenant membership alone. No automatic child replay. A
resolved direct physical parent may become THIS child's new speed prior only if
the persisted exact resolution, same original courier and still-effective parent
prove it. Original GPS/speed/time gates still run; another prior/ancestor blocks.

## Transactions and permissions

NEW in_review sources have NO operational effects. Preparation locks are outside
an inner operational savepoint; rollback drops owner writes and their callbacks.
Then source/item/snapshot/dependencies and exact original evidence bindings persist
under retained locks. Mutated in-memory instances cannot prove a rolled-back effect.
Actual #104 critical-review causes recover through B-07 after commit: an intent is
not delivery, and notification never fabricates a fault or Incident.

Actions preflight paired current scope before resource locks and recheck fresh
locked subjects. Order: sorted original/reviewer User -> actor Device -> Session ->
Pair -> sorted source FieldEvents -> Organization NO KEY UPDATE NOWAIT -> courier
try locks -> Motorcycle -> Shift/ServiceRecord -> point rows -> sorted Uploads.
Fanout couriers precede points. A newly discovered source outside the prelock set
requires retry/block, never a late source lock. No external/storage/broker I/O under
SQL locks. Deferred checks flush inside the bounded 429 mapper. Stale revisions
and unsafe state return 409. Each audit table has its exact table_guard trigger;
raw updates/deletes fail. Deferred completion requires receipt/origin/safety fact
in the SAME transaction. Upgrades do not backfill sources or edit old migrations;
reverse migration refuses existing audit/evidence facts instead of deleting them.

review_item.read controls reads; review_item.decide controls each action. Every
applicable center/quadrant pair must be covered coherently. Unknown source scope
has one explicit exception: ONE contributing grant for the requested permission
must explicitly have BOTH centers=all AND quadrants=all; no union/dimension borrowing
or missing-axis inference. Accept remains blocked. Unknown-scope void records AUDIT
ONLY, nonterminal/pending, with no foreign lookup/labels, source/operational mutation
or unattributable hold clear. The original courier inbox remains.

Uploads retain original UUID and exactly one immutable parent. ReviewItem is the
fourth parent alongside source event, fault and Incident. Supplemental evidence
cannot replace the original declared mandatory upload UUID. Already-bound uploads
require actual parent read authority, not a case/review link as a durable grant.
Verified rows lock in sorted order; no reparenting/download ACL expansion.

## Safety and follow-up Incident

A NEW/unapplied severe source derives a hold without a premature BlockEvent.
Generic discard/open_incident cannot clear it. Optional void safety_disposition
is {inspection_id,attest_safe_now:true}: it requires current review_item.decide AND
motorcycle.service_clear in the actual context, a real unvoided same-Motorcycle
ServiceRecord(kind=inspection), and verified exact ReviewItem evidence. Motorcycle
then fresh ServiceRecord locks remain through commit. ReviewSafetyDisposition
links source/item/decision/Motorcycle/inspection/actor/proofs atomically. Current
attestation uses server time, never a physical-time inference from photo/date or
performed_at. Only this source's derived hold ends; no source effect, maintenance,
BlockEvent, InspectionClearance or other hold changes. Applied faults stay in #103.
Missing proof returns 409 safety_disposition_required and retains pending safety.
ServiceRecord void checks the dependency under those same locks and returns 409
service_has_safety_disposition; a BEFORE UPDATE guard protects raw bypasses.

open_incident is a CURRENT reviewer report at server_now with source_event=None.
ReviewIncidentLink binds its persisted nonterminal decision/item/source before
binding evidence. It requires current incident.create AND review_item.decide,
exact current source/resource context and current #104 type/terminal chain.
Decision/actor/tenant/context/description/evidence/type are revalidated, not trusted
because an internal object or UUID was supplied. Only that case, exact item or
exact source evidence is eligible, with real-parent authorize_download. The
original source_event OneToOne stays free for later valid source acceptance;
case read never substitutes revoked parent read.

Accepted deferred record.void invokes the REAL target hook once. Distinct voids
arbitrate the original source; contention retries and the later loser sees
already_voided. Actual OP16 dependencies still block. Canonical #104 deliberately
retains an Incident/timeline/owned blockers when its source FE is voided: no
fictional dependency, auto-close or compensating case is added.

## Whole closed frame and typed history

ShiftDecision approves/observes only CLOSED shifts without changing lifecycle.
The current vector includes Motorcycle and EVERY source center/quadrant context.
Approval needs effective open/close, no unresolved review/safety blocker and a
current fingerprint. Later sources/decisions invalidate the old approval while
preserving its audit row. A complete unadopted legacy OPEN frame grants no new
work authority. A NEW same-owner/current-authorized close may exit only that
complete already-owned frame with all mandatory close checks/maxima/holds intact.
Reviewed/partial/unproved closure stays pending; no force-close or whole-frame bypass.

One history v1 owner serves review/shift decisions and future #126. Actual
CourierChange + HistoryPublicationReceipt publish once under courier locks.
Current actual subjects filter BEFORE LIMIT/cursor/bootstrap; captured vectors
are audit only. Unknown audit without a safe vector is retained, not broadcast.
Effective selectors serve fleet/ovitraps/shifts/scheduling. Legacy adoption emits
its actual task delta AFTER receipt through the already-retained publisher,
without owner replay, another queue or callbacks taking late domain locks.

## API and verification

GET /review-items/ uses standard page-number paging, kind/code filters, search and
explicit ordering. Detail separates immutable original/provenance from current
state/evaluation and ordered decisions. POST {id}/accept/, void/, open-incident/
returns 201 decision; body: expected_revision, reason, optional evidence_ids (void
also safety_disposition). POST /shifts/{id}/approve/ or observe/ takes revision/reason.
Cookie CSRF, pinned bearer, tenant selection and default-deny mappings are inherited.
No source update/delete, upload transfer, force-close or new permission is added.

Preparation and causal dispatch apply only to registered concrete ReviewAdapters;
handlers without one retain their registered envelope checks and global no-effect
rollback but acquire no artificial Organization/domain locks. Physical parents,
claims and batch-only candidates must resolve a REAL Point covered by current
paired field_event.sync before reporting pending. Candidate payload is only an
ephemeral exact-envelope lookup, checked against its immutable metadata/hash;
it is not authority or a fabricated parent. Replacement claims reserve the NEW
replacement_id, while placements reserve their own ovitrap_id.
An in_review replacement with an observed ovitrap_stale_identity and an already
materialized replacement UUID in the same organization creates no new parent
claim. Its original claim and physical row remain untouched, even when final
upload is the primary review code. New identities still reserve one immutable
claim; voiding a pending placement does not make its UUID reusable.

A known owned nonsevere in_review target without an effective effect may be
cancelled through canonical record.void and its REAL owner hook, including a GPS
review without an operational row. It gains no acceptance/effect receipt or false
effective-parent resolution. Unknown batch targets still require causal proof.
An exact pending severe hold is checked again before voided_at can change,
including retained facts with unknown policy versions. The v1 clearance remains
strictly limited to supported v1 proof; unknown policy cannot release retention.
Generic source void cannot bypass its safety disposition, and owner OP16/refusals
remain. The void's own clock/final-upload review still rolls back all its effects.

Criterion -> tests: test_review_policy_b_17 (pure policy/observed inputs),
test_reviews_b_17 (no effects, original replay, causal identity, safety/inspection
barriers, follow-up private evidence, legacy frames), test_review_effects_113
(Fuel context, source void and target race), test_review_legacy_113 (all concrete
legacy owners/partial), test_shift_validation_b_17 (closed frame, typed sequence,
cursor/bootstrap/current vector), test_review_items_api (HTTP/unknown exception),
test_review_migrations_113 (upgrade/raw guards/deferred completion/reverse).
Existing owner/sync/upload/incident/seed tests preserve established contracts.
PostgreSQL/migrations/concurrency require REAL CI; local collection/pure checks
are not SQL verification. Unsupported release/count/laboratory families and
unprovable historical sources remain explicitly blocked without invented permits.

Review/void invalidation (#113): the unique history owner derives the actual owned
void target through the ORIGINAL envelope under already-retained source locks.
It invalidates both the source's own frame (if any) and the effective void target's
real frame after effect/receipt. No old FK is filled, no UUID coincidence grants
access, and no late locks/general fault/config listeners are added. Repeated
noncurrent payloads are deduplicated under the original courier lock; original
approval/history and lifecycle remain immutable.

#126 extends this same history producer to schema2 with relocation_proposal;
the review/shift branch retains its fields. Current real proposal/point subjects
authorize changes/bootstrap before paging. Only late_work_after_quadrant_close is
added to OvitrapReviewAdapter's reviewable codes; postclosure capture cannot gain
retroactive authority. The owner retains original epoch/assignment/closure identity
alongside selected point/rules/speed facts. See ../geography/decisions/README.md.

#106 adds the concrete TransferReviewAdapter, retained inventory boundary and a
transfer_source dependency beneath the same owner. Current action and decide each
require ONE binding covering both endpoints/all lines. Original field.sync remains
historical proof; a reviewer does not need a new sync credential. No retroactive
signature, protocol, scope or safety default is inferred. Unknown capture pins and
partial materialization block acceptance. The only cross-author SQL exception is
the exact real signed dispatch link/hash plus typed same-transfer child snapshot;
old ovitrap/shift/void branches retain their predicates. Source hooks append no FK
to an unstored FieldEvent: linkage follows the real canonical effect receipt.

The same history producer advances to schema3 with transfer_custody event UUID id
and transfer_id, shared by changes/bootstrap after current complete-vector scope.
Its real original source courier is the recipient; HTTP creates no courier record.
VoidReviewAdapter delegates actual transfer audit inspection to its domain owner;
old manifests/legs remain immutable, consumed/uncompensated effects block void.
See ../inventory/transfers/README.md for SQL and test ownership.

## Laboratory history (#114)

Lab appends to this SAME typed history owner. Producer 4 preserves all original
review/shift/relocation/transfer fields and refs; root bootstrap stays 2. Lab
receipt/discrepancy/count/rejection/void facts resolve their current authentic
Reading and original collector before scope/cursor/limit. System request causes
update the real human count's QA projection; no fake ReviewItem, decision,
recipient or independent-counter action is produced. Stored projections survive
temporary download loss; regrant still reads through current FIELD_BOOTSTRAP.
publish_history remains the sole receipt/change writer.

## Concrete courier supply adapter (#107)

supplies.receive/reconcile use the SAME kernel, retained original proof, typed
same-author supply_source dependency and once-only effect receipt. NEW in_review
has zero operational effects; acceptance rechecks original/current/reviewer whole
physical vector without weakening other adapters. Actual supply authors/sources
are prepared before all User/account/domain locks; changed closure re-prepares.
One post-store hook binds real FieldEvents, publishes eight typed supply history
kinds through publish_history and supplies upserts. HTTP return acceptance and
justification invalidate the existing Shift decision fingerprint/history using
their real execution cause, without synthetic FEs or a second history publisher.
