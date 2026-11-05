# field_sync

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

Dependency: `field_sync` creates `reviews.ReviewItem` rows (`reviews.services`) and reads them for `changes`; `reviews` only points at `FieldEvent` by a string foreign key and never imports `field_sync` code except constants and the event model type. Keep it one-way.

Rules for code in this app and in handlers: nothing is deleted; a handler writes only inside the savepoint the pipeline opens and calls no external service; no user-facing text (codes and params only); a new final result code needs a row in `docs/sync.md` and `sync.result.*` keys in both languages of `packages/i18n` (a test checks it). The retry-only quota code is documented here; its mobile handling/localization is outside #56's backend scope. Tests: `backend/tests/test_sync_*.py`; test-only event types live in `tests/testapp/handlers.py`.

`record.void` schema 1 takes `{reason_code, reason?}` (#80). The shared organization-scoped
resolver rejects unknown/foreign codes and invalid text before checking deactivation. A known
inactive choice raises `EventNeedsReview("void_reason_code_deactivated")` and leaves every
target void field intact, including when the batch is already under review. Applied voids store
both code and note. Supervisor acceptance and the target's `on_void` hook remain #22.

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
six-section BundleProducer registry (registered once from owning AppConfig.ready),
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
No operational in_review effects or acceptance handler are added (#22).

Acceptance tests: tests/test_field_sync_b_13.py. No new event result codes/locales.
