# field_sync

## Paired current capture context (#289)

Bootstrap and every normal changes page expose optional/nullable root
capture_context: schema_version 1, permission field_event.sync, self user/org UUIDs,
scope_revision and complete effective WorkScope pairs. The pure selector projects
only the SAME captured ctx.scope grants containing FIELD_EVENT_SYNC; member/profile
intersection and government restrictions are already applied. It performs no Me,
permission/profile read, SQL, new lock or I/O. MeScopeSerializer supplies the existing
canonical grammar per whole pair, without using display-only get_scope. Never union
axes. Empty grants is known denial; absence/null is not an implicit grant.

The root bundle contract advances from 1 to 2; registered producer versions, SECTION_KEYS,
payloads and feed writers stay unchanged. Metadata/root/cursor share one computed
scope revision. ETag includes metadata and generation but excludes generated_at/
cursor, so a scope-only or revoke/regrant generation changes the body even with
unchanged geometry. Existing live bearer/route checks still run before 304. This is
a current observation, not original authority, a capability or offline permanence.

Normal omitted/null HTTP cursor decodes to ChangesCursor() and publishes initial
metadata. It is not a complete bootstrap. Explicit internal None/final upload emits
null context and pulls nothing. Concurrent admin changes after ctx capture remain
detectable on next pull; do not recompute ctx/revision after ingest or add a late
Organization/User/source lock.

#138 owns actual decode/materialize/provider/SQL readiness and owner/session/ABA
fences. Full bootstrap alone hydrates missing foundations; old body/delta/304 cannot
prove readiness. Preserve immutable drafts/outbox/evidence and final receipts before
cleanup. Same-user new sessions/reinstalls cannot adopt unproved legacy ownership.
Offline revocation has its observation limit. This does not supply fake M08 bag/
reuse/inventory assignments or implement GPS, camera #253, B33 history, #287 advisory
consumption or native qualification. See docs/sync.md#paired-current-capture-context-289.

Criterion map: test_field_sync_b_13 covers pure pairs/schema, public disjoint scope,
old-root-cursor replay and both existing captured-configuration barriers;
test_bundle_producers_196 extends real assign_profiles revoke/regrant plus semantic
ETag; test_sync_api retains exact final no-pull shape with null context. SQL/HTTP/
barrier tests require PostgreSQL; collection/DB-free passes are not execution proof.

## Review integration (#113)

Every NEW in_review result rolls back its inner operational savepoint and callbacks.
Preparation source/Org/domain locks survive until source/item/snapshot/dependencies
and exact evidence bindings persist. Optional concrete ReviewAdapter prepares locks,
copies original JSON observations, inspects exact legacy rows and returns actual
materialization IDs when executing. No generic replay/acceptance framework exists.
reviews registers the single typed history producer; current actual subject scope
filters before LIMIT/cursor/bootstrap. Critical-review causes recover through actual
#104/B-07 after commit; an intent is not delivery. See ../reviews/README.md.

Handlers without ReviewAdapter keep normal envelope checks and no-effect review
rollback, without acquiring invented tenant/domain locks. Known own nonsevere
reviewed targets may be corrected through canonical record.void and their real
on_void hook without first accepting them. Generic void rechecks the exact pending
severe source hold before mutating the target; missing targets remain causal and
the correcting event's own clock/final-upload signal still prevents effects.

The phone's sync API (issue #5): `POST /api/v1/field/sync/`. Read [`docs/sync.md`](../../docs/sync.md) first (contract, codes, guarantees, how to register a handler) and [`../accounts/README.md`](../accounts/README.md) for the lock order.

| Module | What lives there |
| --- | --- |
| `models.py` | `RejectionQuotaCounter`: mutable device/local-day bookkeeping (#56); `FieldEvent`: insert-only (client UUID pk, raw `payload`, status `accepted`/`rejected`/`in_review`); only the void fields can change; a trigger guards raw SQL |
| `registry.py` | `EventHandler`, `register()`, `find_handler()`, `EventContext`: each epic registers its event types from `AppConfig.ready()` |
| `services.py` | `sync_batch` (courier try lock, lock timeout, ingest, pull) and `ingest_batch`: `(device_time, id)` order, one savepoint per event, idempotency, atomic rejection quota claims and on-commit threshold alerts |
| `clock.py` | Clock skew policy (`sent_at` against the server clock, threshold from `get_values_in_force`) |
| `envelope.py` | Plain dataclasses: `EventEnvelope`, `EventResult`, `BatchContext`, payload facts (size, hash, NUL, depth) |
| `codes.py` | Per-event codes: final verdict groups plus the retry-only quota control code; i18n/docs contract tested |
| `exceptions.py` | `EventRejected`, `EventNeedsReview` (per event) and the batch errors |
| `cursor.py`, `selectors.py` | The signed strict `changes.cursor`; `build_changes`; the stored-event lookup |
| `handlers/void.py` | `record.void` |
| (`shifts/`) | `shift.open` and `shift.close` are registered by the `shifts` app (#68); `shifts` also registers `shifts.guard.check_event_shift` with `registry.register_envelope_check`, which the pipeline runs for every event whose handler keeps `checks_shift=True` (the default); `field_sync` never imports `shifts` |
| `serializers.py`, `views.py`, `throttling.py`, `urls.py` | The endpoint: `FieldSyncViewSet` (with `FinalUploadMixin`), per-device throttle |

Dependency: field_sync creates immutable review sources/items; review actions use the
registered concrete owner adapter. Imports across services stay local to avoid
cycles; models never import services. There is one typed history producer.

Rules for code in this app and in handlers: nothing is deleted; a handler writes only inside the savepoint the pipeline opens and calls no external service; no user-facing text (codes and params only); a new final result code needs a row in `docs/sync.md` and `sync.result.*` keys in both languages of `packages/i18n` (a test checks it). The retry-only quota code is documented here; its mobile handling/localization is outside #56's backend scope. Tests: `backend/tests/test_sync_*.py`; test-only event types live in `tests/testapp/handlers.py`.

`record.void` schema 1 takes `{reason_code, reason?}` (#80). The shared organization-scoped
resolver rejects unknown/foreign codes and invalid text before checking deactivation. A known
inactive choice raises `EventNeedsReview("void_reason_code_deactivated")` and leaves every
target void field intact, including when the batch is already under review. Applied voids store
both code and note. #113 acceptance revalidates mandatory checks and calls the
target's real on_void once; original source status is unchanged.

## Rejection quota (#56)

`SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY` defaults to 1000 (env range 100..10000; fail fast).
`SYNC_REJECTION_ALERT_PERCENTS` defaults to 80,100 (nonempty comma-separated integers in 1..100).
Only new rejected rows count; accepted/in-review events and replays do not. The quota row is
mutable and scoped to the organization; its unique `(device, local_date)` index arbitrates
creation and the conditional `F` increment arbitrates shared-device concurrent batches.
The claim and `on_commit` alerts are inside the rejection savepoint, so a lost id race returns
its slot. All events use the batch receipt's organization-local day (one quota row per batch).
A quota wait uses the existing timeout/deadlock-to-429 mapping. See the accounts lock order.

Quota exhaustion is `200` with per-event `rejection_quota_exceeded`, not a blanket `429`.
That event has no FieldEvent or ReviewItem; the phone must preserve its evidence and retry
after `params.retry_after_seconds` (also the response's conditional `Retry-After` header).
Other events in the batch proceed. The retry-only control code is separate from final,
translated rejection codes; mobile recovery/localization is outside this backend issue.
Full contract and concurrency rule: [`docs/sync.md`](../../docs/sync.md#rejection-quota-56-sa09).


## Assigned bootstrap and change producers (#110 / B-13)

`GET /field/bootstrap/` requires live DeviceBearerAuthentication and
field.bootstrap; it never uses FinalUploadMixin. `producers.py` defines the fixed
nine-section BundleProducer registry (registered once from owning AppConfig.ready),
ProducerContext, schema boundary and licensed PMTiles manifest contract. Until
dependency apps register their producer, each section is an empty list.

`CourierChange` is an immutable organization/courier sequence log. The new schema
migration adds its table, constraints and raw UPDATE/DELETE guard only. The
once-only organization default seed grants field.bootstrap to existing seeded
courier/admin profiles and preserves later revocation; run
`seed_organization_defaults --apply` when upgrading an existing organization.

Every writer must hold lock_courier_batches in the same transaction as the domain
write AND append_courier_change through commit. Append verifies a transaction-local
lock marker, validates the registered producer payload, then allocates max+1.
Never write the feed in an on_commit callback. Bootstrap and both sync feed pages
share that lock. Try-lock contention is retryable 429; no network/storage/mail runs
inside it. See docs/sync.md for producer metadata/scope requirements and lock order.

Cursor v2 binds both sequences and a canonical paired effective-scope revision.
V1/expired/changed-scope cursors fail before ingest; recover through bootstrap,
atomically replace only downloaded projections and retain the independent outbox.
Native storage integration belongs to M-01. Bundle schema_version hashes the
registered producer schemas, including empty ones; bundle_version/ETag hashes
content except generated_at and cursor. Existing rules/catalog snapshots provide
next_change_at refresh while capture-time evaluation retains historical versions.
NEW in_review effects roll back; #113 review decisions apply supported effects
through their concrete owners and append immutable receipts.

Acceptance tests: tests/test_field_sync_b_13.py. No new event result codes/locales.


Scope capture uses ONE membership SELECT with an ArraySubquery of active assigned
same-organization profiles, including current user/organization activity. Both
bootstrap and initial/cursor sync compute effective grants from that statement's
snapshot; the shared algebra never performs a later profile read on this path.
A transaction at READ COMMITTED alone cannot prevent mixing old membership scope
with new profile scope. Capture takes no configuration row lock after the courier
lock; existing lock order is preserved. Regression:
`test_producer_scope_capture_never_mixes_membership_and_profile_revisions` pauses
after the membership statement while an organization-locked admin transaction
commits both scope changes. CI runs this PostgreSQL test; it uses no sleeps.


## Sampling points and ovitraps (#196)

Geography registers quadrants (quadrant/block references) and sampling_points;
ovitraps registers ovitraps. All have schema_version=1 and concrete shared payload
schemas in projection_serializers.py. Snapshot/feed share paired field.bootstrap
scope; ctx.includes remains a second metadata check. Selectors use four queries
for the three producers, with no per-row reads. Final upload returns nine arrays.

services.fanout_courier_changes is the reusable upsert-only writer boundary.
For #212, its optional courier_id narrows delivery to one of the already captured,
scoped and locked recipients. It never adds a recipient or takes a later lock;
ovitrap/geography broadcast delivery remains the default. Scheduling task upserts
use this owner filter; assignments v3 includes is_completed on task rows only.
Domain writers take their organization serialization lock, obtain all affected
courier try-locks in ascending advisory-key/user-id order (skip transaction-local
held locks), write effects and append under those locks through commit. A failed
lock propagates retryable 429 with full rollback. CourierContext represents web
feed ownership without an invented device. [ASSUMPTION] SYNC_MAX_FANOUT_COURIERS
(default 1000, positive) caps active bootstrap-candidate memberships before scope
algebra; cap overflow is 503 fanout_limit_exceeded, with no partial effects.

Void is an upsert tombstone, never remove. D7b keeps point/block parents immutable;
scope loss uses cursor revision -> invalid_cursor -> re-bootstrap. See
../../docs/sync.md#geography-and-ovitrap-producers-196 for payloads, resource versions,
lock paths, catalog/rule coverage and reversible CHECK migration 0006. PostgreSQL
migration/lock tests and npm run api:generate remain lead integration checks.


### #196 criterion-to-test map

All names below are in tests/test_bundle_producers_196.py (test_ prefix omitted).
Database cases are authored for the lead's PostgreSQL; only the contract and pending
check ordering cases run without PostgreSQL here.

| Criterion / invariant | Regression |
| --- | --- |
| Organization + center + quadrant isolation, sync-only exclusion, active recipients | bundle_and_feed_isolate_both_scope_dimensions_organization_and_sync_only |
| In-scope latest boolean state, no counts/people/lab, fan-out once, replay, cursor advancement | lifecycle_fans_out_once_replays_do_not_duplicate_and_bundle_has_no_counts |
| Placement tombstone retained | voided_placement_remains_a_tombstone_in_snapshot_and_feed |
| Reading tombstone recomputes earlier live state | void_latest_reading_restores_previous_nonvoided_check_state |
| Correction of reviewed events without operational effects | void_reviewed_event_without_operational_row_preserves_history_without_projection (two cases) |
| Retroactive pending check does not overwrite newer device-time state | pending_offline_check_cannot_replace_newer_device_time_state (DB-free, two cases) |
| All geography writers emit written versions | geography_creation_and_publication_writers_emit_exact_versions |
| D7b keep/move/remove same-scope publication | quadrant_republish_upserts_resolution_points_and_ovitraps_in_same_scope (three cases) |
| Fan-out try-lock contention maps to 429 without partial domain/feed | sync_contention_maps_to_retryable_429_with_no_partial_writes (deterministic injected try-lock contention) |
| Fan-out cap fails before domain insertion | fanout_cap_fails_closed_before_domain_write |
| Rejected event savepoint rolls back already appended feed | rejected_event_rolls_back_changes_already_appended_in_its_savepoint |
| Four-query producer bound grows points, ovitraps and readings | bundle_build_query_count_stays_bounded_as_points_and_readings_grow |
| Scope revision rejects old cursor; re-bootstrap replaces projections | scope_revision_invalidates_cursor_and_bootstrap_replaces_downloaded_rows |
| Three producer schema registrations change schema boundary; concrete OpenAPI | new_producers_have_concrete_contracts_and_change_schema_boundary (DB-free) |

Existing tests/test_sync_api.py only gains the three contract-required keys,
including nine empty final-upload arrays. No cross-quadrant move/remove test is
added because parent identities are immutable (D7b).


### Local verification for #196 (2026-11-05)

- Ruff 0.8.4: `ruff check backend` passed; changed-scope format check passed (51 files).
  Full backend format check reports the pre-existing tests/test_motorcycle_services.py.
  The pinned Ruff 0.17.3 was not available/run in this environment.
- `.venv/Scripts/python.exe -m mypy .`: passed, 169 source files.
- `pytest -m 'not django_db' -q`: 191 passed. New module's DB-free selection:
  3 passed, 15 PostgreSQL cases deselected; no new case exceeded 2 s of call time.
- `manage.py check --settings=config.settings.test`: no issues.
- `manage.py spectacular --settings=config.settings.test --urlconf=config.urls
  --validate --fail-on-warn --file NUL`: passed, no warnings/errors for real routes.
  Exporting tests.urls instead reported expected serializer errors in test-only views;
  that output was not used as the public schema.
- `manage.py makemigrations --settings=config.settings.test --check --dry-run`:
  no model changes; migration-history validation could not connect to placeholder 55499.
- `git diff --check`: passed. No Docker, applied migration, commit, push or PR.
- GitHub issue lookup returned 401; implementation uses the owner's complete issue
  text and decisions. `npm run api:generate` was inspected but not run (owner
  restriction). OpenAPI/client artifacts remain for lead regeneration.
- PostgreSQL tests, real SQL/query-count bound, advisory contention, and migration
  forward/reverse remain unverified. No connection to host 5432 was attempted.


## Ovitrap lifecycle (#112)

Courier ovitrap schema 1 adds optional is_retired, default false when absent.
Existing fields retain their meanings. Resource hashes include outgoing live
lineage/removal UUIDs; replacement/removal use the same atomic fan-out boundary,
while relocation proposals emit no geometry or physical projection changes.
B33 publishes their typed history through the existing113 producer after the real
source exists, with its internal publication receipt. See
../ovitraps/lifecycle/README.md and ../../docs/sync.md for locks and acceptance map.

## Independent evidence references (#102)

_store calls the evidence-only link hook after inserting the actual verdict. Raw
capture UUIDs remain on immutable FieldEvent even without bytes/metadata or when
review prevents effects. Existing owned metadata binds after source insertion;
late metadata binds explicitly to that exact declaration. Sorted Upload NOWAIT
locks precede required evidence effects. No file/network I/O, extra account/domain
lock, review acceptance or source rewrite is introduced. Existing 429 rollback and
final-upload/session-end boundaries remain intact. See ../uploads/README.md.

#104 registers incident.report/emergency.accident v1. Existing review_code is checked
before operational writes. _store adds an after-commit critical-source callback
after actual FieldEvent/ReviewItem/evidence linkage; a review callback produces only
a scoped audit intent, never an Incident/owner/blocker. Immutable committed causes
support keyset recovery after callback/broker loss. No delivery or #113 acceptance
is asserted; current final-upload entitlement/session ordering remains unchanged.

#106 registers only transfer.dispatch/transfer.receive schema1. They do not require
a Shift, so checks_shift=False is explicit for these two families; global actor,
clock/final-upload and source digest gates remain. They are not supplies.receive.
NEW review retains source facts/evidence with0 operational custody/stock effects.
_store links the actual accepted source after its snapshot and primary evidence
exist. Reviewed application waits for canonical113's exact effect receipt. The ONE
history producer is schema3 with an additive transfer_custody branch; old review,
shift and relocation shapes remain. No fake HTTP courier or delivery receipt.

## Laboratory projections (#114)

The ONE history producer advances from 3 to 4, adding authentic Lab receipt,
discrepancy, count, rejection and void payloads. The four old kind mappings and
whole-transfer scope remain. BOOTSTRAP_SCHEMA_VERSION stays 2 and the outer hash
stays opaque. Lab commands are server operations, not courier event types. Current
source/recipient subjects filter history before download; storing an updated QA
projection grants no FIELD_BOOTSTRAP and proves no delivery. Independent requests
are real; execution belongs to #115.

## Courier supplies (#107)

Two schema1 shift-checked sources use existing preparation/review/on_void and real
post-store source identities. Complete historical User/source preparation precedes
account locks even in final upload; no new sync endpoint or session writer exists.
Supplies producer1 owns current self Assignment facts. History5 retains old kinds;
root bootstrap2 is unchanged. Supply changes filter exact current full-vector and
own action BEFORE count/order/LIMIT. Scope-revision changes require existing
readiness/retention invalidation; cached hidden rows never authorize a capture.
See docs/sync.md for typed source payloads, review codes and fresh replay authority.
