# ovitraps

B-14 / #111. Read ../field_sync/README.md, ../../docs/sync.md, ../accounts/README.md
and ../../docs/engineering-rules.md before changing these handlers.

## Lead decisions (ADR 99)

1. Inventory B-10, attachments B-04 and incidents B-06 are absent from the supplied
   baseline. supply_refs/evidence_ids are lists of at most 100 UUID strings retained
   unchanged on PlacementAttempt as opaque, unverified references. No stock is
   consumed. Exactly-once consumption integration is a follow-up when inventory
   exists: it must join the handler savepoint and event-uniqueness boundary.
2. Assignments #8/#9 are absent. Ownership means current field_event.sync authority
   AND center AND quadrant covered by one effective profile/membership grant (SA02
   none/selected/all). Unknown/foreign/ungranted points share the same rejection.
   Voids revalidate current scope before effects or dependent IDs are exposed.
3. Historical rules use EventContext.rules_at(device_time); exact applied rule ids
   are retained separately from the phone's rules_version. max_distance_to_point_m
   keeps OP03 default 50 m, bounds 10..200. New versioned max_gps_accuracy_m has
   **[ASSUMPTION]** default 50 m and bounds 1..200 until pilot confirmation.
   Missing/nonpositive/unusable accuracy, missing/nonfinite/out-of-bound required
   rules or missing/retired historical PointVersion never pass a gate. Distance
   reuses geography.geometry.distance_m. Speed uses historical speed_lock_kmh and
   previous accepted nonvoided ovitrap capture at/before this courier's device_time.
   **[ASSUMPTION]** there is no tracking app; no previous capture means no comparison.
   All review signals (including final upload/clock/shift) precede operational writes.
   Accepting review is #22, outside scope.
4. Ovitrap, PlacementAttempt and OvitrapReading reference their FieldEvent uniquely.
   Bag shares the reading event and has organization-unique code. Savepoints and
   constraints prevent replay duplication; codes remain reserved after void.
   record.void invokes on_void(ctx,target_event), appending OvitrapVoid. Normalize
   every ovitrap reason with core.void_reason: minimum 10 visible characters by
   default, maximum 1000, including regular catalog choices. The generic pipeline
   updates only allowed void metadata, never original ingest status. Nothing is
   deleted or overwritten. Existing readings block placement void with safe IDs.
   A bag is intrinsic reading provenance and shares its lifecycle. No lab reception,
   count or incident dependency exists on this baseline; none is invented.
   Sync conflicts remain per-event results under HTTP 200. There is no HTTP
   correction route in these read-only resources; future HTTP dependent corrections
   must use 409/blocked_by for dependents that actually exist.
5. One active physical-ovitrap/local-epi-week reading is enforced by organization
   serialization. Void first, then submit a correction with an unused bag code.
   Lagged paddles remain countable. **[ASSUMPTION]** rules/seeds has no index
   exclusion rule: persist is_index_excluded=is_lagged, reason=lagged, with evaluated
   rules. is_countable means present paddle and unvoided reading, regardless of lag.
6. Findings/paddle types resolve from the exact archived catalog_version delivered
   to the phone. catalogs.CatalogSnapshot is immutable; GET /field/catalog/ archives
   delivered hashes idempotently, including 304. Missing archive reviews; unknown
   choice within it rejects; retained now-inactive choice reviews like void reasons.
   Labels/Other flags come from the historical snapshot. Pre-archive downloads
   cannot be reconstructed and fail closed to review. Seed only missing
   closed-house/absent/destroyed findings, protected Other, and paddle-type
   (standard + Other); preserve labels and inactive states. Other is explicitly
   available on the retained closed finding catalog. other_text is required for
   any chosen Other and forbidden otherwise. No inventory or attachment app is added.
7. Present paddle requires boolean has_eggs, paddle_type and bag_code. No paddle
   requires null eggs/type/bag. closed-house/absent/missing/destroyed imply no paddle.
   Strict payload serializers reject ALL unknown keys, including egg_count, eggs
   and count, independent of value. Couriers never submit numeric egg counts.
8. QR is ASCII wbf:1:<kind>:<hyphenated UUID>; kinds lot/ovitrap/bag/release-device/
   sample. parse_qr never silently reinterprets a failed scan. Manual capture is
   explicit in the existing manual_capture envelope flag. Physical ovitrap UUID
   is phone-generated, stored as client_uuid unique per organization. A separate
   server-generated UUID primary key serves internal foreign keys. The public API
   id/code, detail lookup and reading.ovitrap expose the physical client UUID;
   bag_code remains the separate human code.
9. GET /api/v1/ovitraps/, /readings/, /bags/ and /{uuid}/ details are read-only,
   page-number paged, stable ordered, with code/status/point/week filters.
   Ovitrap/reading code is the UUID; bag code is human. List status defaults active;
   voided/all are explicit, detail defaults all. week=YYYY-Www uses local ISO/MMWR.
   Foreign point filters/details return 404; actions default-deny. ovitrap.read
   reads identities; reading.read reads readings/bags. Admin/supervisor/coordinator
   get both once; entomologist reading.read only. Grant-once seed preserves revoked
   codes and custom profiles. Membership/pinned device session defines organization,
   never body/query. Session cookie/CSRF and bearer policies are inherited.
   Provenance includes event UUID, both timestamps, GPS/manual flag, rules/catalog
   tokens, historical point/rule ids, author and lifecycle metadata.
10. Every declared handler code has docs/sync.md and es-MX/en sync.result.* entries;
    existing test_sync_registry checks that contract without duplicate tests.
11. Locks: existing User -> Device -> DeviceSession -> TokenPair, then courier try
    advisory lock, Organization NO KEY UPDATE, SamplingPoint NO KEY UPDATE, Ovitrap.
    Organization serialization arbitrates weekly readings/bags and privilege removal.
    Generic record.void owns its target event lock before on_void; all subsequent
    waits/deadlocks stay under the pipeline's 429 sync_in_progress mapping. No
    account locks occur below domain locks; no network/storage/mail in handlers.

## Files and invariants

models.py defines insert-only identities/effects/lifecycle; migration 0002 guards
raw SQL UPDATE/DELETE. services.py writes only inside the registry savepoint;
selectors.py applies paired scope and server filters; capture.py evaluates history;
findings.py resolves archived catalogs; payloads.py rejects unknown keys;
handlers.py follows shifts/handlers.py. No third-party dependency is added.

## Acceptance map

All new cases are in ../tests/test_ovitraps_b_14.py; helpers in ovitrap_support.py.

| Criterion | Tests (test_ prefix omitted) |
| --- | --- |
| Payload | payload_accepts_only_conditional_boolean_eggs; payload_refuses_every_unrecognized_key_including_courier_counts; other_text_is_required_only_for_other; unavailable_house_or_ovitrap_skips_egg_question; placement_bounds_opaque_uuid_references; QR cases |
| Replay/barrier/scope | barrier_races_never_duplicate_reading_or_bag (replay/week/bag, two connections, barrier, retry after committed 429 only); foreign_assignment_and_unknown_point_have_identical_results; void_after_scope_loss_cannot_disclose_dependents_or_correct_records. Stock is inapplicable per decision 1. |
| Historical/lab/correction | review_capture_creates_no_operational_effects; historical_location_and_rules_are_used_at_capture_and_retained; lagged_check_repeat_void_and_correction_preserve_lab_provenance; closed_house_reading_keeps_history_without_a_bag; old_catalog_token_resolves_retained_deactivated_choice_without_effects; delivered_catalog_version_keeps_its_labels_and_missing_archive_reviews; speed_anomaly_reviews_without_a_new_placement; place_void_with_existing_reading_returns_safe_blocker_and_rolls_back; repeat_window_uses_organization_local_epi_week |
| Contract/wiring | read_endpoints_enforce_default_deny_and_org_center_quadrant_isolation (one wiring test); missing_accuracy_reaches_handler_instead_of_losing_event_at_envelope_validation; existing test_sync_registry; spectacular validation/export; api:generate |

## Verification boundaries

Docker/PostgreSQL are unavailable here. DB-marked tests, migrations/triggers and
barriers must run in the orchestrator's isolated project, never host 5432.
DB-free: pytest tests/test_ovitraps_b_14.py tests/test_sync_registry.py -m 'not django_db'.
Run ruff lint/format, mypy, spectacular --validate --fail-on-warn and api:generate.
The handoff lists actual results separately from unexecuted checks.

Verified API references:
- https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update
- https://stacks.cdc.gov/view/cdc/22305/cdc_22305_DS1.pdf (MMWR Sunday start,
  first week contains at least four days of the calendar year).


## Local handoff (2026-11-05)

- No commit, push, PR, applied migration or Docker run. GitHub lookup returned 401;
  the owner's complete issue text and lead decisions supplied the specification.
- pytest B-14 + registry + rule/geography contracts, `-m 'not django_db'`: 69 passed,
  39 deselected; B-14 alone collects 63 cases (42 unit, 21 PostgreSQL).
- Ruff 0.8.4 available locally: full backend lint and changed-file format passed.
  The project's pinned Ruff 0.17.3 was not run; only local 0.8.4 was used.
- mypy .: passed, 164 files. manage.py check: no issues.
- makemigrations --check --dry-run: no model changes. Migration-history consistency
  could not connect to unused placeholder 55499; migrations/triggers and DB/barrier/
  endpoint tests remain unverified until the orchestrator runs isolated PostgreSQL.
- spectacular --validate --fail-on-warn: passed, zero warnings; openapi.yaml exported
  with installed locked Python dependencies (Django 5.2.19).
- npm test --workspace=packages/i18n: 13 passed. TypeScript catalog layout follows
  repository formatting; no installed Prettier/typecheck tool is claimed.
- npm run api:generate: uv failed persisting its interpreter cache (access denied).
  No cache relocation or permission changes. The existing Python runtime exported
  the schema independently. The generator export placeholder now uses 55499.
- npm exec --workspace=packages/api-client --no-install -- openapi-typescript ...:
  generator not installed; npm attempted package resolution despite no-install,
  so the command was cancelled. Generated schema.ts is intentionally untouched and
  is stale until the orchestrator regenerates it with installed locked dependencies.
- git diff --check: passed. Code/security review found and verified corrections for
  current-scope void checks, exact catalog archive resolution and voided detail reads.


## Adversarial correction: organization-scoped physical identity

Ovitrap.client_uuid reserves the phone-generated UUID only in its organization
(ovitrap_org_client_uuid). Ovitrap.id is a separate server-generated internal PK;
PlacementAttempt/reading foreign keys keep that internal identity. Sync place
prechecks and the unique-collision mapping use organization/client_uuid, and
check/void resolve the client UUID through the existing scoped selector. A UUID
in another organization behaves exactly like an unused one, including missing-GPS
review. The internal primary key collision is never reported as identity_used.

Public id/code and /ovitraps/{id}/ continue using the phone UUID, as does the
reading's ovitrap reference. ?code= filters client_uuid for ovitraps; reading
and bag identifiers retain their existing semantics. The initial migration is
updated because this app is new in this branch; no deployed-data migration is
assumed. No new sync code or dependency is introduced.

Regression: test_foreign_physical_uuid_and_unknown_uuid_share_gps_review compares
signal class/code/params against a foreign existing and an unused UUID. It failed
with identity_used versus gps_unusable before the fix, then passed. It runs without
PostgreSQL using an equality-only in-memory store; the real handler decides scope.
The single existing endpoint isolation test now places the same physical UUID
in two organizations and checks distinct internal PKs plus public list/detail and
reading references, ensuring each organization resolves its own identity. That
PostgreSQL integration and real concurrent/constraint enforcement remain pending
while Docker is blocked. No commit/push is part of this correction.


Correction verification: B-14 + sync registry DB-free selection passed 51 cases
(21 PostgreSQL cases deselected); mypy . passed on 164 source files; full backend
Ruff 0.8.4 lint and 16 affected-file format checks passed. manage.py check passed;
makemigrations --check --dry-run detected no changes, with migration-history
connectivity still unavailable at placeholder 55499. OpenAPI validation/export
passed without warnings and produced no schema diff: public UUID wire types are
unchanged. git diff --check passed. Read-only review found no remaining concrete
issue in the identity correction. Database application, unique constraints and
concurrent PostgreSQL enforcement were not executed; Docker remains blocked.


## Courier projection (#196)

apps.ready registers the ovitraps bundle producer at schema 1. The typed row
contains identity, immutable placement point_version, current sampling_point_version,
placed_at and latest NON-voided check by (device_time, event_id), with boolean
has_eggs and nullable state when no reading remains. No numeric egg/lab data,
other courier identity, GPS trail or free-text void reason is downloaded.

Place/check/on_void emit upserts to EVERY active in-scope field.bootstrap member,
using the one field_sync fan-out helper inside the sync savepoint. Existing actor
locks are skipped; other try-lock contention rolls back effects/feed with 429.
The pending FieldEvent is not inserted yet, so placement uses its EventContext
and a check overlays the pending reading only if its device-time order is newer.
Historical backdated checks still advance the append-only lifecycle version.
The version is a stable SHA-256 of placement UUID/void state, reading/void revision
counts and current point version, shared by bundle and feed resource_version.

A correction is never remove: placement_voided identifies a voided placement;
voided/voided_resource_type/voided_event_id/void_reason_code/voided_at retain the
latest tombstone. voided_event_id references FieldEvent, reading_id references
OvitrapReading. A reading correction recomputes the previous live check, while a
later replacement preserves correction history. Voided placements remain in the
bundle. A point publication upserts affected ovitraps without rewriting placement
provenance. Parent identities are immutable (D7b), so scope loss uses cursor
revision -> invalid_cursor -> bootstrap, without a scope-remove writer.

Findings, egg paddle types, void choices and required rule keys already belong
to existing catalog/rules snapshots; no configuration producer is added. See
../../docs/sync.md for the bound [ASSUMPTION], lock order, exact fields and migration.
Tests: ../tests/test_bundle_producers_196.py covers fan-out, once-only pulls/replay,
placement/reading tombstones, fallback to earlier checks, isolation and query bound.


## Lifecycle (#112, B-15 / ADR 120)

lifecycle/ is part of this app, imported by models.py and registered by apps.ready.
See [lifecycle/README.md](lifecycle/README.md) for the full decisions, invariant/lock
order, boundaries and criterion-to-test map. Replacement preserves the fixed point
and inserts physical lineage; relocation is proposal-only; removal retires the trap.
Active selectors/placement occupancy derive from nonvoided lineage/removal. Exact
code lookups include retired identities unless status is explicit. New event review
writes no operational effects. Voids append corrections and preserve dependents.

Existing historical OP03 rules are reused unchanged. Catalog seeds add only missing
relocation reasons and abandoned/removed findings. No inventory/attachment/incident
app is introduced: evidence is opaque and one unique authored incident-link marker
is available for B-06. The future closure gate reads has_unresolved_removal; explicit
recovery resolution remains a follow-up. Courier schema 1 gains optional is_retired
and revision hashes include lineage/removal event UUIDs; replace/remove fan out,
relocate does not. No original FieldEvent ingest status or geometry is rewritten.
