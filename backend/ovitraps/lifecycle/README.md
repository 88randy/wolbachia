# Ovitrap lifecycle (B-15 / #112)

Package inside the existing ovitraps app. Read ../README.md, ../../field_sync/README.md,
../../../docs/sync.md and ADR 120 before changing it. No new app or dependency.

## Scoped OP03 read (#287)

`GET /api/v1/field/ovitrap-advisories/{physical-client-UUID}/?at=...` supplies an
optional exact-cutoff relocation advisory. This new read policy was selected by
the orchestrator under delegated authority; no personal client approval is implied.
DeviceBearer must be active and both field.bootstrap and field_event.sync must
each cover the actual point's center/quadrant pair. It does not use ovitrap.read,
final capability, Me's flat projection or downloaded rows as capture authority.

advisory_selectors.py owns the shared OP03 rule bounds, real selected version/value/
effective_from tuples and fixed-point facts. Existing suggest_relocation remains
the legacy bool wrapper: absent rules false; unexpected errors still propagate.
Closed-house labels are the current local week plus N-1 predecessors, distinct and
in required order, bounded by N<=8. Incident links are point-wide across physical
lineage/couriers with device_time<=at and current nonvoid sources, without a week
window or general Incident lookup. Existing effective/void owners supply the facts;
a ReviewDecision alone is not an effect and status=in_review is never rewritten.

advisory.py takes User→Device→DeviceSession→TokenPair NOWAIT, then Organization
NOWAIT NO KEY UPDATE and repeats current paired authority/point resolution in that
SAME transaction. Authentication's own bookkeeping remains outside it. No source,
courier or late account locks, I/O, models/migrations/defaults or publication writes.
field_views.py validates an explicit aware protocol at and reauthorizes before ETag
handling. serializers.py describes nullable result fields and rule tuples.

See ../../../docs/api-conventions.md#scoped-relocation-advisory-287 for exact DTO,
errors, private caching and same-at known-projection semantics. In particular a
future_cutoff state can become available by clock alone, without business writes;
equal versions require equal computed state and content, not merely unchanged rows.
This is explicit revalidation, not bootstrap/delta delivery. Unproved context is
unavailable/null, never fabricated zero. An unavailable advisory alone adds no
capture block; existing capture authorization, rule, GPS and evidence gates still
apply. #138 must retain its frozen rule and authority proof.
Known scope/session/owner invalidation hides active guidance; fully offline
retained data cannot be immediately erased remotely. Camera/native work stays
in #253/#138/#130; this aggregate is not device or capture qualification.

Acceptance coverage (SQL/HTTP/barriers require PostgreSQL CI):

| Criterion | Test owner |
| --- | --- |
| Canonical lineage/cutoff/void and bounded ordered weeks | Existing B15 closed_house_suggestion and incident_threshold tests, extended with duplicate and out-of-window labels, the upper bound of eight, and void/cutoff assertions. |
| Aware input, explicit null, unexpected legacy failure, schema | tests/test_ovitrap_advisory_contract_287.py (DB-free). |
| Rule tuples, clock transition to 200/new ETag/304 and no business writes | clock_transition_recomputes_state_before_etag_without_business_writes. |
| Both real paired actions, private 304 denial, active bearer only | actual_bearer_both_paired_actions_and_current_denial_before_304. |
| General Incident excluded, actual reviewed effects/replay/void, original source/geometry retained | new_known_review_effect_and_void_change_same_cutoff_not_geometry. |
| Real Organization arbiter, both reader/writer winner orders | reader_and_real_rule_writer_share_organization_boundary (Event+SQL barrier). |

The last four names are in tests/test_ovitrap_advisory_read_287.py. Local collection,
schema generation and pure checks are not SQL/HTTP/concurrency execution evidence.

## Decisions and boundaries (ADR 120)

- Ovitrap remains immutable. Replacement inserts a phone-generated organization-unique
  physical client_uuid, the same SamplingPoint, its capture-time PointVersion and a
  PhysicalOvitrapLineage linking old/new identities to the effective FieldEvent.
  The fixed point code and all retired identities remain available. `?code=` defaults
  to all physical states unless status is explicitly supplied. Lists otherwise default
  active; status=all includes retired identities and status=voided selects voided sources.
- Active means an unvoided placement/replacement source and no unvoided outgoing
  lineage or removal. The placement occupancy gate uses that same selector. A removal
  frees the point. Voiding replacement restores the old identity by projection only.
- RelocationProposal stores old/new [longitude, latitude], archived reason/labels,
  opaque evidence and applied rule/version ids. It never publishes PointVersion or
  changes geometry. B33's authorized RelocationDecision writer appends a separate
  decision and exact next PointVersion on approval, or a real next-local-day task
  on rejection. Status derives from decision rows. See
  ../../geography/decisions/README.md for closure, history and original proof.
- Existing historical OP03 definitions are reused unchanged: closed_house_weeks_to_relocate
  defaults 2 (1..8); incidents_to_relocate defaults 3 (1..10). `suggest_relocation`
  counts distinct closed-house findings in every one of the latest N local epi weeks,
  or nonvoided incident links across physical identities at the fixed point. Invalid
  or absent historical rules suppress the suggestion; they never block a proposal.
- RemovalAttempt stores confirmation/is_recovered, recovered|unrecovered, event and
  incident_link. Accepted abandoned/removed findings also create the same unique
  OvitrapIncidentLink. Organization+physical-trap uniqueness plus a savepoint reserve
  one append-only marker, even if the source is later voided. Reading projections expose
  it for abandoned/removed findings; removals/history expose it too. No incident app/FK
  is invented. B-06 can adopt its UUID. Unrecovered removals are exposed by
  has_unresolved_removal(organization, quadrant_id, point=...) for future closure.
  #217 adds the explicit recovery resolution writer documented below.
- Attachments and inventory are absent. Evidence remains opaque, unverified UUID
  strings (at most 100), preserved exactly; no upload status or stock effects are
  invented. Lifecycle capture with no evidence reviews as ovitrap_evidence_required.
  GPS/accuracy, point/rules, distance, speed and clock/shift/final-upload review reuse
  B-14. Every signal precedes ALL operational writes, including incident markers/feed.
  B-22 owns authorized acceptance; original ingest status is never rewritten here.
- Reasons use the exact archived delivered catalog, reusing findings.resolve_item and
  validate_other_text. Existing replacement/removal catalogs are reused; only missing
  relocation-reason and abandoned/removed findings are seeded, with protected Other.
  Reruns preserve labels/deactivations. Other requires text; regular choices forbid it.
- record.void reuses core.void_reason normalization (10 visible characters minimum,
  1000 maximum for every lifecycle void) and appends OvitrapVoid. Replacement void
  refuses any reading/replacement/removal/proposal on the new identity, including
  voided dependents; proposal decisions block proposal void. Removal void refuses a
  competing active identity at its point. Placement void also preserves lifecycle
  dependents. Current sync permission AND paired center/quadrant scope are rechecked
  before returning safe dependency IDs. Source evidence/status and dependents survive.
- All new concrete models inherit ImmutableMixin/OrgScopedModel through OvitrapRecord.
  Migration 0003 creates schema/constraints and reversible UPDATE/DELETE triggers using
  the existing ovitrap_insert_only_guard. No data migration or rewrite.

## Locks and courier projections

Existing User -> Device -> DeviceSession -> TokenPair precede the actor courier
advisory try-lock. Organization NO KEY UPDATE serializes scope/configuration and
identity allocation, then the shared fanout_courier_changes helper acquires all
remaining recipient try-locks before SamplingPoint NO KEY UPDATE and the old
Ovitrap. The new identity is inserted only after the old identity is locked; a
previously used replacement UUID reviews without locking/reusing that identity.
This follows ADR 118's fan-out boundary: recipient locks are try-only, so an inverted
courier attempt fails with retryable 429 instead of waiting. All later row waits and
deferred constraints remain under sync's timeout/deadlock-to-429 mapping. Generic
void owns its target FieldEvent lock before on_void. No account lock is acquired
below this boundary; no network/storage/mail is called under locks.

Replacement emits old/new upserts; removal emits a retired upsert. Proposal emits
nothing. Schema 1 adds optional is_retired (default false for old producer payloads),
so existing fields retain their meaning and consumers can upgrade additively.
Resource-version hashes include nonvoided outgoing lineage/removal event UUIDs;
void restores the derived state and changes the revision. Retirement selectors use
an exclusion subquery of voided source UUIDs, so they also see the operational row
before ingest inserts its deferred source event. The new trap's source is overlaid
from EventContext; bootstrap and post-commit feed then agree.

## HTTP

- GET /api/v1/relocations/: relocation.read, page-number paging; code (proposal UUID),
  status=pending|approved|rejected, point, physical ovitrap, include_voided=false;
  ordering=created_at|event__device_time|ovitrap__sampling_point__code (optional minus).
  No voided proposal appears in the default pending queue. Include it explicitly
  for evidence; no HTTP decision/mutation route is provided.
- GET /api/v1/ovitraps/{physical UUID}/history/: ovitrap.read, point-wide physical
  lineage and lifecycle sources/void references chronologically, with source UUID,
  author, fixed point code, both clocks, ingest/void state, GPS, archived original
  payload and applied lifecycle provenance. Physical payload UUIDs must be strings (never numeric JSON); text spellings normalize only in reads;
  original envelopes remain untouched. Ordinary readings/bags require reading.read
  and are excluded from this lifecycle history.
- Existing cookie/CSRF and pinned bearer rules apply. Organization comes from
  membership/session, never a selector in URL/body. Permissions default-deny and
  intersect center AND quadrant. Foreign filter/detail references are 404.
- relocation.read is granted once to seeded admin/supervisor/coordinator by the
  existing READ_CODES default seed; revoked codes and custom profiles stay intact.

## Acceptance map

All names below are in tests/test_ovitraps_lifecycle_b_15.py (test_ prefix omitted).
Reuse tests/ovitrap_support.py; do not duplicate B-14 catalog/Other/QR cases.

| Issue criterion | Behavior coverage |
| --- | --- |
| Fixed code and complete lineage | replacement_retains_point_code_lineage_and_fans_out_once; void_replacement_restores_old_identity_without_mutating_source_or_lineage |
| Proposal-only, replay and incident/removal | relocation_is_only_a_replayable_proposal_without_feed_or_geometry_change; removal_recovery_retires_once_and_unrecovered_blocks_closure; abandoned_or_removed_findings_link_one_incident_through_removal; barrier_replay_never_duplicates_lifecycle_rows |
| Rules, Other, ownership, compensation | historical_advisory_thresholds_use_op03_bounds; closed_house_suggestion_uses_latest_epi_weeks_and_is_advisory; incident_threshold_counts_fixed_point_across_physical_replacements; other_reason_uses_exact_archived_catalog_without_overwriting_evidence; foreign_unknown_and_ungranted_physical_identity_share_one_rejection; foreign_author_and_scope_loss_voids_never_expose_dependencies; void_dependency_gates_preserve_source_and_compensation_boundary; replacement_and_removal_stale_identity_review_without_second_effect |
| Review/fan-out/concurrency | review_has_no_lifecycle_or_projection_effects; removal_feed_changes_revision_and_void_restores_closure_gate; new_handler_lock_contention_is_retryable_429_without_partial_effects (two connections, explicit lock/release barrier, no sleeps) |
| Contract wiring | new_endpoints_default_deny_and_isolate_org_center_quadrant (single endpoint wiring test, including noncanonical archived UUID and retired lookup); lifecycle_payload_rejects_organization_and_bounds_evidence; lifecycle_refuses_numeric_uuid_that_cannot_round_trip_archived_history; proposal_refuses_unusable_location; existing test_sync_registry; spectacular/client export |

Docker/PostgreSQL execution is reserved to the lead's isolated database (never host
5432). The handoff reports exact local checks separately from unexecuted SQL guards,
migration application/reversal, endpoints and concurrency tests.


## Local verification (2026-11-05)

No commit/push/PR/deployment, Docker or applied migration. The owner's supplied
issue text is the specification; GitHub was not queried (known 401).

- `ruff check backend`: passed (installed Ruff 0.8.4; pinned 0.17.3 not run).
  Changed-scope `ruff format --check`: 28 files passed. Full backend format check
  finds only pre-existing tests/test_motorcycle_services.py; it was left untouched.
- `.venv/Scripts/python.exe -m mypy .`: passed, 206 source files.
- `manage.py check --settings=config.settings.test`: no issues.
- `manage.py makemigrations --check --dry-run --settings=config.settings.test`:
  no model changes. History consistency could not connect to unused placeholder
  55499 (connect_timeout=2). No SQL migration was applied or reversed.
- `pytest tests/test_ovitraps_lifecycle_b_15.py tests/test_ovitraps_b_14.py
  tests/test_sync_registry.py -m 'not django_db' -q`: final 73 passed, 57 deselected.
  B-15 contains 58 cases: 22 DB-free and 36 PostgreSQL cases reserved for the lead.
- Full DB-free run before the final four numeric-UUID regression cases: 265 passed,
  2 settings subprocess failures, 1306 deselected. Both failed cases passed on the
  isolated rerun (2 passed). The initial run included a Windows subprocess output
  UnicodeDecodeError; no settings/test helper was changed. The full suite was not
  rerun after the scoped numeric-UUID correction; the affected selection above was.
- `manage.py spectacular --settings=config.settings.test --urlconf=config.urls
  --validate --fail-on-warn --file ../packages/api-client/openapi.yaml`: passed,
  no warnings, using Django 5.2.19 / DRF 3.18.3 / spectacular 0.30.0.
- `npm run api:generate`: wrapper failed on sandbox-denied uv interpreter-cache
  persistence. No cache relocation/permission workaround. The existing Python
  runtime exported the schema, and installed openapi-typescript 7.13.0 generated
  schema.ts (`npm exec --workspace=packages/api-client --no-install -- ...`).
  A repeated local export/generation produced identical schema/type hashes.
  The wrapper's unused database placeholder is now 55499, never host 5432.
- `npm test --workspace=packages/i18n`: 13 passed; api-client: 19 passed.
- `node scripts/typecheck.mjs packages`: failed due to a Node/V8 out-of-memory
  abort. A direct local tsc attempt also aborted; package type-check is unverified.
  No dependencies, memory limits or compiler settings were changed.
- `git diff --check`: passed. Code/security reviews' concrete findings were fixed
  and confirmed by read-only follow-up; no PostgreSQL execution was claimed.

PostgreSQL service/endpoint/barrier tests, unique/deferred constraints, SQL guards,
migration forward/reverse and CI remain unverified. Use the lead's isolated
Postgres, never host 5432. Evidence IDs remain unverified by explicit lead decision,
not an attachment/storage guarantee; physical recovery resolution is a follow-up.

## Resolve an unrecovered removal (#217)

RemovalResolution is an insert-only, one-to-one supervisor fact referencing a
specific RemovalAttempt. It stores outcome=recovered_later|written_off, normalized
reason, author and server timestamp. Both outcomes require the existing reason
minimum (default 10 visible characters, maximum 1000); no new catalog or business
threshold is introduced. Source archived reason choices/labels need not still be
active: resolution neither reevaluates nor overwrites capture evidence. Original
recovery_state, incident link, FieldEvent status/clocks/payload and history remain.
Physical history adds effects.resolution; its recovery_state is still the original.

POST /api/v1/ovitrap-removals/{removal_id}/resolve/ requires removal.resolve and
{expected_state,outcome,reason}. The explicit expected state can be unrecovered,
recovered, resolved or voided; only current unrecovered can transition. Foreign or
ungranted removal IDs are indistinguishable 404 before locks. Any stale expectation,
already recovered/voided source or existing resolution is 409 removal_state_conflict.
Success is 201 {id,removal,outcome,reason,created_by,created_at}. No GET/PUT/PATCH/
DELETE/void action is added for the immutable decision. Existing physical history
already exposes removal_id and source recovery/void state for the supervisor.

Concurrency rule: scope-check the removal first; source FieldEvent NOWAIT NO KEY
UPDATE -> Organization NOWAIT NO KEY UPDATE -> fresh membership/paired-scope and
state checks -> append -> deferred constraint checks -> commit. Generic record.void
already holds the source FieldEvent before Organization, so no inverse lock is
introduced. The source arbitrates double/void resolution; Organization serializes
new removals and configuration. No explicit account locks, courier feed or network
I/O is needed. Reuse sync's bounded lock timeout; source/organization contention,
lock waits and deadlocks return 429 removal_in_progress with Retry-After: 1 and
rollback. Deferred constraints are checked inside that error mapping. One-to-one
uniqueness and migration 0004's reversible UPDATE/DELETE guard protect the audit;
there is no data backfill or new app/dependency.

A resolution is retained as an OP16 dependent: later record.void of its removal
returns existing ovitrap_void_blocked with its safe resolution ID. A void that wins
first instead makes resolution stale. No compensation or history deletion is
invented. has_unresolved_removal excludes only resolved removal rows; a later
unrecovered physical identity at the same point remains a blocker. The selector
has NO implemented quadrant-closure caller in this baseline; actual closure and
incidents remain separate B-33/#104 work. No sync producer/event contract changes.

Seeded admin/supervisor get removal.resolve once through the established seed;
custom profiles, revoked grants and existing tenants stay unchanged until an
explicit seed_organization_defaults --apply. Migration 0004 is schema/guards only.

Tests live in tests/test_removal_resolution_217.py; existing seed-profile coverage
is updated in place. PostgreSQL cases are collected locally and run in real CI;
collection does not verify transactions, constraints or migrations.

| Criterion / invariant | Test (test_ prefix omitted) |
| --- | --- |
| Both outcomes clear selector blocker, original source/evidence preserved, explicit author and history audit, endpoint 201 | resolve_clears_only_the_removal_blocker_and_preserves_audited_source (two outcomes) |
| Another unrecovered physical identity remains a blocker | another_physical_removal_at_same_point_remains_a_blocker |
| Stale expectation, double, voided and recovered reject with 409/no new fact | stale_or_ineligible_removal_returns_409_without_another_resolution (four states) |
| Org + both scope dimensions + paired grants + default deny before locking/validation | resolution_endpoint_default_denies_and_hides_foreign_scope (five restrictions) |
| Archived source reason is retained; resolved source cannot be voided | resolution_retains_archived_reason_and_blocks_void_as_a_dependent |
| Raw SQL cannot update/delete audit facts | database_guard_preserves_resolution_audit (two statements) |
| Deferred-check contention rolls back the inserted resolution and maps retry | deferred_constraint_contention_rolls_back_resolution_and_maps_retry |
| Actual source/organization arbitration against double resolution, void and new removal | resolution_serializes_with_double_resolution_void_and_new_removal (three cases, two connections and Event barrier; bounded lock timeout is the behavior under test) |
| Existing reason-normalizer wiring and concrete expected-state/audit schema | resolution_requires_an_auditable_visible_normalized_reason; resolution_openapi_exposes_expected_state_and_immutable_audit (DB-free; core owns the normalizer's individual cases) |

## Verified capture evidence (#102)

Replace/relocate/remove require UploadVerification owned by the capturing user/device
and unbound or bound to that exact event UUID. Sorted Upload NOWAIT locks follow
existing lifecycle locks and precede effects/feed; no file/network I/O runs here.
Pending or other-source evidence uses existing ovitrap_evidence_required review.
Post-_store binds evidence independently of effects. Late finalize preserves the
original verdict; #113 owns acceptance. RemovalResolution's source FieldEvent →
Organization rule is unchanged. Existing B-15/#217 tests now provide verified facts;
their resolution races/OP16 blocker stay meaningful. See ../../uploads/README.md.
