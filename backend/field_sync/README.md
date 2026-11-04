# field_sync

The phone's sync API (issue #5): `POST /api/v1/field/sync/`. Read [`docs/sync.md`](../../docs/sync.md) first (contract, codes, guarantees, how to register a handler) and [`../accounts/README.md`](../accounts/README.md) for the lock order.

| Module | What lives there |
| --- | --- |
| `models.py` | `FieldEvent`: insert-only (client UUID pk, raw `payload`, status `accepted`/`rejected`/`in_review`); only the void fields can change; a trigger guards raw SQL |
| `registry.py` | `EventHandler`, `register()`, `find_handler()`, `EventContext`: each epic registers its event types from `AppConfig.ready()` |
| `services.py` | `sync_batch` (courier try lock, lock timeout, ingest, pull) and `ingest_batch`: `(device_time, id)` order, one savepoint per event, idempotency, rejection storage |
| `clock.py` | Clock skew policy (`sent_at` against the server clock, threshold from `get_values_in_force`) |
| `envelope.py` | Plain dataclasses: `EventEnvelope`, `EventResult`, `BatchContext`, payload facts (size, hash, NUL, depth) |
| `codes.py` | The per-event result codes (one list; i18n and docs are tested against it) |
| `exceptions.py` | `EventRejected`, `EventNeedsReview` (per event) and the batch errors |
| `cursor.py`, `selectors.py` | The signed strict `changes.cursor`; `build_changes`; the stored-event lookup |
| `handlers/void.py` | `record.void` |
| (`shifts/`) | `shift.open` and `shift.close` are registered by the `shifts` app (#68); the pipeline also calls `shifts.guard.check_event_shift` for every event that names a `shift_id` and whose handler keeps `checks_shift=True` (the default) |
| `serializers.py`, `views.py`, `throttling.py`, `urls.py` | The endpoint: `FieldSyncViewSet` (with `FinalUploadMixin`), per-device throttle |

Dependency: `field_sync` creates `reviews.ReviewItem` rows (`reviews.services`) and reads them for `changes`; `reviews` only points at `FieldEvent` by a string foreign key and never imports `field_sync` code except constants and the event model type. Keep it one-way.

Rules for code in this app and in handlers: nothing is deleted; a handler writes only inside the savepoint the pipeline opens and calls no external service; no user-facing text (codes and params only); a new result code needs a row in `docs/sync.md` and `sync.result.*` keys in both languages of `packages/i18n` (a test checks it). Tests: `backend/tests/test_sync_*.py`; test-only event types live in `tests/testapp/handlers.py`.
