# scheduling

B-12 / #109: protocol-labelled risk imports, courier allocations and day/week
planning. The owner's supplied full issue and lead decisions define this work;
GitHub inventory remains unverified (401 reported by the lead). No route
optimization, screens, deployment or review acceptance is added.

## Lead decisions (ADR 113)

1. CSV only: UTF-8 with optional BOM, comma delimiter, double-quoted fields,
   header required, max 1 MiB and 5000 data rows. Required columns are exactly
   block_code,category; protocol is optional. Unknown/duplicate columns and
   duplicate normalized block codes are errors. Categories are low/medium/high
   **[ASSUMPTION until the client confirms the official scale]**. source is
   official_import or company_rule; protocol is NFC/whitespace-normalized, <=80
   characters. WE03: risk is a protocol label, never release/permit authority.
   XLSX is deferred: no dependency or compressed upload surface is introduced.
2. stdlib csv.reader uses strict Excel dialect and a process-wide 128-character
   field limit; cells remain plain text. Controls (including NUL, tab, CR) and
   formula prefixes = + - @ after normalization are rejected. Errors contain
   codes and row numbers, never rejected cell text. Accepted block codes <=50,
   categories and protocol values are normalized and capped before preview.
   No formula evaluation or CSV export is added.
3. Immutable RiskImportUpload retains organization, author, SHA-256, size,
   normalized basename, bytes and creation time. POST risk-category-import-uploads
   accepts multipart file under risk_import.apply. A first upload handler stops
   incoming bytes above 1 MiB before downstream memory/disk handlers; the service
   also checks the bounded read. A per-user DRF throttle uses the repository
   cache conventions (THROTTLE_RISK_IMPORT_UPLOAD_RATE, **[ASSUMPTION]** 10/hour).
   Session/CSRF and pinned bearer authentication are inherited. **[ASSUMPTION]**
   database bytes are temporary storage until the attachments/S3 integration.
4. week accepts YYYY-MM-DD, a local date in the organization's epi week, and is
   normalized/stored as its start. core.time shares ISO/MMWR calculation with
   ovitraps.capture; no second epi-week algorithm exists. Block codes resolve
   within organization AND risk_import.apply center/quadrant scope. Unknown and
   out-of-scope codes both yield block_inaccessible. Preview writes only import
   metadata and never categories/assignments/tasks. Any error blocks apply.
5. Apply serializes Organization NO KEY UPDATE NOWAIT, affected couriers, then RiskImport NOWAIT.
   Fresh application checks expected_revision=1 and re-resolves every scoped
   block; scope loss is 404. Changed epi-week/timezone or recorded block scope
   mismatch is 409 import_scope_mismatch. All category successors and the unique
   RiskImportApplication append atomically. applied_at/applied_by derive from
   that immutable application. Retries return the same application and append
   nothing, even with the original expected revision. Latest block/week version
   wins; earlier source/origin/protocol versions remain. ORM guards and migration
   0002 reject UPDATE/DELETE of every planning table, including raw SQL.
6. AssignmentVersion appends quadrant, nullable courier, valid_from, author and
   per-quadrant version. Supersession closes the previous assignment logically;
   assignment_at(quadrant, instant) resolves the historical capture owner with
   an inclusive instant and version tie break. PUT expects the quadrant revision
   (0 initially), validates current actor scope and active same-organization
   courier field_event.sync scope for that quadrant. It changes allocation;
   moving existing pending tasks is the separate reassignment operation.
7. ScheduledTask identity is unique organization/point/action/due_date. Only
   place/check are derived: no active nonvoided placement means place on week
   start; otherwise check is due once the latest nonvoided placement/reading's
   local date reaches revisit_interval_days at that due date. Overdue checks
   start at week start; subsequent checks in that week use the configured rule
   at each day, without a target cap. Applied rule version ids are retained.
   Generate appends missing tasks once, under organization and point locks;
   GET never writes. The effective assignment at generation becomes ownership
   revision 1; invalidated/unassigned courier authority leaves no owner row and
   blocker unassigned. **[ASSUMPTION]** remove is omitted: master has no accepted
   removal lifecycle effect. Point retirement is excluded from new generation.
8. GET schedule filters week/courier/day/quadrant/code and orders risk descending,
   due date, point code, action, id; absent risk is lowest with null provenance.
   Task code is point:action:YYYY-MM-DD (exact scoped lookup). Load counts pending
   tasks from the entire filtered caller-visible list before pagination, including
   unassigned work separately. Target is a DAILY operational target, not a weekly
   sum or hard cap: daily_task_target defaults 40, integer count 1..200
   **[ASSUMPTION]** until client confirmation. Task targets resolve at their due
   date; page target resolves selected day/week start. Missing historical target
   falls back to the documented 40 default. Week/day views share one endpoint.
9. All writers serialize on the same organization NO KEY UPDATE NOWAIT lock;
   authority is re-read inside it. They append an organization ScheduleRevision
   on apply/assignment/generation/reassignment (idempotent retries append none).
   Schedule GET holds the same lock while reading pagination/load/revision so
   a returned optimistic token belongs to those rows. Reassignment accepts this
   PAGE schedule revision, distinct from per-task ownership revisions. Duplicate
   task_ids deduplicate, 1..200 input ids. It locks visible points in UUID order,
   re-checks pending state and atomically appends owners. A recorded placement or
   reading for that task's point/action/local date rejects the whole request,
   409 task_completed with only visible task ids/codes. Existing ownership rows
   remain. Stale writers get 409 stale_revision; contention/deadlock gives
   429 scheduling_in_progress and Retry-After: 1. Organization and point locks
   coordinate with existing ovitrap effect writers. No User/Device/Session/Token
   locks, storage, network or mail are taken under these locks; any future account
   integration must preserve User -> Device -> DeviceSession -> TokenPair first.
10. SchedulingConfig.ready registers one assignments v1 BundleProducer. Its flat
    rows have kind=quadrant_assignment|task, stable id (quadrant/task UUID), quadrant_id,
    courier and revision. Tasks add code, point, action, date, category, source,
    protocol, is_completed and target; no egg counts. Bootstrap uses the active
    courier membership and captured permission/paired scope; organization_id and
    center_id metadata are checked before serialization and remain private.
    change_assignment emits allocation remove/upsert without moving existing tasks;
    generate_schedule emits each new owned task; reassign_pending emits old-owner
    remove/new-owner upsert; apply_import refreshes owned tasks in its week when
    category/source/protocol changes. Every domain write and CourierChange append
    shares the planning transaction. Resource types are quadrant_assignment/task,
    scope is {center_id,quadrant_id}, and content-hash resource_version changes even
    when risk changes without an ownership revision. Replays append no extra changes.
    Capture-time assignment resolution remains available; review acceptance is #22.
11. Permissions default-deny: schedule.read/manage for seeded supervisor/admin;
    schedule.read and risk_import.apply for entomologist; risk_import.apply for
    admin. Existing once-only defaults preserve revoked grants/custom profiles.
    EffectiveScope checks one paired action AND center AND quadrant grant; none
    and empty selected deny, all is explicit. Every org is membership-derived;
    no URL/body organization selector exists. Foreign refs/foreign scopes are
    indistinguishable 404; courier filters require shared applicable field scope.
12. No HTTP delete/void endpoint. OP15 normalized visible-character 10..1000
    validation and OP16 dependent preservation apply when void endpoints are added.
    New in_review events have no new effect here; authorized acceptance belongs
    to #22. Original FieldEvent result, clocks and provenance remain untouched.
13. Page-number lists, server filters/order, exact scoped codes, 400 code/detail/
    fields validation, 409 safe blocked_by state errors. Schema annotations cover
    every route and request/response. The lead runs npm run api:generate to export
    packages/api-client/openapi.yaml and regenerate TypeScript in the integration
    PR; no generated client is hand edited here. No sync events/result codes change.
14. All new tests are in tests/test_scheduling_b_12.py. PostgreSQL cases use the
    existing pytest setup; races use Barrier/Event, never sleeps. No host port
    5432, commit or push is used in this worktree. PostgreSQL/CI checks remain a separate gate.

## Integration and lock order

Organization NO KEY UPDATE NOWAIT stays first; all affected courier advisory
try-locks follow in sorted user UUID order, before domain writes or point locks.
Domain row locks use NOWAIT. These explicit locks never wait: if sync holds a
courier while seeking a planning lock, either attempt fails and rolls back, so
there is no lock cycle. Both database contention and SyncInProgressError map to
429 scheduling_in_progress with Retry-After: 1. Locks stay held through commit;
no account locks or network/storage/mail occur beneath them. The one documented
courier BatchContext helper has device=cast(Device, None): producer lock/append
APIs use only organization/user and planning has no sending device.


## API

All routes have /api/v1/ prefix. No organization input field is accepted as scope.

| Method/path | Input / output |
| --- | --- |
| POST risk-category-import-uploads/ | multipart file -> upload_id, sha256, size |
| POST risk-category-imports/ | upload_id,week,source -> immutable preview/errors/revision |
| POST risk-category-imports/{uuid}/apply/ | expected_revision -> stable application id, risk_import, applied_at, applied_by |
| GET risk-categories/ | required week; optional block,quadrant,code,ordering=block__code/category/created_at (minus for descending) |
| GET quadrant-assignments/ | current rows, optional courier,quadrant,center,code; ordering=code/load with optional minus |
| PUT quadrant-assignments/ | quadrant_id,courier_id (nullable),expected_revision -> exact assignment and schedule_revision |
| POST schedule/generate/ | week -> created,revision |
| GET schedule/ | required week; optional courier,day,quadrant,code; paged results plus schedule revision, scoped load and daily target |
| POST schedule/reassign-pending/ | task_ids,courier,expected_revision -> schedule revision, exact new owner revisions |

Example CSV:

```csv
block_code,category,protocol
B-01,high,pilot protocol
B-02,low,
```

Preview errors: invalid_utf8, file_too_large, invalid_columns, invalid_csv,
invalid_row, unsafe_cell, invalid_block_code, invalid_category, invalid_protocol,
duplicate_block, too_many_rows, empty_import, block_inaccessible. Invalid preview
rows never become effects. Upload validation also uses csv_required,
invalid_filename; reference errors remain 404. Missing revisit policy prevents
check generation atomically (409 revisit_rule_not_configured).

## Acceptance criterion -> test

| Criterion | Tests in test_scheduling_b_12.py |
| --- | --- |
| Preview no effects, apply replay/source | test_preview_has_no_effects_apply_replay_preserves_versioned_source; test_invalid_import_scope_loss_and_policy_mismatch_never_partially_apply |
| Hostile CSV and bounds | test_csv_formula_cells_are_rejected_without_echoing_attacker_text; test_csv_limits_duplicates_and_invalid_input_have_coded_errors; test_csv_row_and_field_caps_prevent_unbounded_preview; test_csv_bom_and_normalization_preserve_protocol_provenance |
| Concurrent reassignment/history | test_racing_reassign_retains_prior_owner_and_loser_has_explicit_conflict; test_assignment_at_retains_capture_time_owner_and_rejects_stale_revision |
| Due/risk/load/target/scope | test_generation_due_risk_order_scope_load_and_target_are_the_returned_tasks; test_completed_tasks_abort_entire_reassignment_and_unassigned_tasks_are_explicit; test_planning_and_capture_share_epi_week_boundaries; test_normalized_first_supported_week_can_be_used_again_internally |
| Contract/scoped wiring | test_endpoint_default_deny_and_foreign_org_center_quadrant_isolation; test_live_scheduling_schema_exposes_requests_paging_and_revision_contract; test_planning_date_extremes_have_coded_validation_instead_of_overflow; spectacular --validate --fail-on-warn; lead regenerates client |
| Offline own/scope isolation | test_bootstrap_assignments_contains_only_own_in_scope_planning_rows |
| Feed ownership and allocation revocation | test_reassignment_delivers_remove_and_upsert_with_contiguous_sequences; test_assignment_change_revokes_quadrant_without_moving_existing_tasks |
| Courier contention/retry | test_busy_affected_courier_returns_retryable_429_without_partial_writes |
| Strict phone payload | test_assignment_producer_rejects_invalid_phone_payloads; test_assignment_producer_projects_only_assignment_fields_and_hides_metadata |
| Feed rollback and replay | test_failed_generation_rolls_back_domain_and_courier_changes; test_generation_replay_does_not_append_duplicate_courier_changes |
| Risk feed provenance/current owner | test_import_delivers_changed_risk_to_current_task_owner_once |
| Insert-only durability | test_database_guards_protect_import_and_ownership_history |

Default profile grant expectations in test_seed_defaults.py are updated in place;
existing seed tests protect once-only grants/revocations without duplicated cases.
Seed-count assertions already derive len(DEFAULT_PARAMETER_SEEDS), now 15.

## Verified APIs (no added dependencies)

- [Django 5.2 AppConfig auto-discovery and ready](https://docs.djangoproject.com/en/5.2/ref/applications/)
- [Django 5.2 QuerySet locking](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update)
- [Django 5.2 upload handlers](https://docs.djangoproject.com/en/5.2/ref/files/uploads/#writing-custom-upload-handlers)
- [Python 3.13 csv](https://docs.python.org/3.13/library/csv.html)

Planning input dates use the same technical 2020-01-01..2100-01-01 window as
field sync; out-of-range week/day returns 400 out_of_range, never date overflow.


## Initial B-12 handoff (2026-11-05, before producer integration)

- Branch feat/109-assignments-scheduling. No commit, push, PR, merge or deployment.
- Runtime: Django 5.2.19, DRF 3.18.3, drf-spectacular 0.30.0; no new dependency.
  The available local Ruff is 0.8.4; CI's own toolchain remains the integration gate.
- DJANGO_READ_DOT_ENV_FILE=false for all Django checks; DATABASE_URL points to
  unused isolated port 55499 with connect_timeout=1. No host 5432 use, Docker or gh.
- ruff check . passed. ruff format --check on changed Python modules passed.
  Full backend format check reports only pre-existing tests/test_motorcycle_services.py;
  that unrelated file was left untouched.
- .venv/Scripts/python.exe -m mypy . passed for 175 source files.
- pytest -m 'not django_db' -q passed: 219 tests, 1171 DB cases deselected.
  B-12 has 47 collected cases: 38 DB-free and 9 PostgreSQL cases. The nine database
  cases are NOT run here (including actual barriers, triggers and HTTP isolation).
- manage.py check passed. spectacular --urlconf config.urls --validate
  --fail-on-warn --file schema.yml passed without warnings (test settings, production
  URL config; schema.yml is the existing ignored local export path).
- Initial migration generated using Django's offline MigrationAutodetector/Writer.
  Comparing MigrationLoader(None) project state to ProjectState.from_apps reports
  no model changes. PostgreSQL migration application/history remains unverified.
- git diff --check passed. The lead must run the PostgreSQL suite and npm run
  api:generate in the integration PR; packages/api-client was not hand-edited.
