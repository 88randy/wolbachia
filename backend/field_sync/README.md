# field_sync

The phone's sync API (issue #5): `POST /api/v1/field/sync/`. Read [`docs/sync.md`](../../docs/sync.md) first (contract, codes, guarantees, how to register a handler) and [`../accounts/README.md`](../accounts/README.md) for the lock order.

| Module | What lives there |
| --- | --- |
| `models.py` | `FieldEvent`: insert-only (client UUID pk, raw `payload`, status `accepted`/`rejected`/`in_review`); only the void fields can change; a trigger guards raw SQL |
| `registry.py` | `EventHandler`, `register()`, `find_handler()`, `EventContext`: each epic registers its event types from `AppConfig.ready()` |
| `services.py` | `ingest_batch`: device lock, `(device_time, id)` order, one savepoint per event, idempotency, rejection storage |
| `clock.py` | Clock skew policy (`sent_at` against the server clock, threshold from `get_values_in_force`) |
| `envelope.py` | Plain dataclasses: `EventEnvelope`, `EventResult`, `BatchContext`, payload facts (size, hash, NUL, depth) |
| `codes.py` | The per-event result codes (one list; i18n and docs are tested against it) |
| `exceptions.py` | `EventRejected`, `EventNeedsReview` (per event) and the batch errors |
| `cursor.py`, `selectors.py` | The signed `changes.cursor`; `build_changes`; the stored-event lookup |
| `handlers/void.py` | `record.void` |
| `serializers.py`, `views.py`, `throttling.py`, `urls.py` | The endpoint: `FieldSyncViewSet` (with `FinalUploadMixin`), per-device throttle |

Rules for code in this app and in handlers: nothing is deleted; a handler writes only inside the savepoint the pipeline opens and calls no external service; no user-facing text (codes and params only); a new result code needs a row in `docs/sync.md` and `sync.result.*` keys in both languages of `packages/i18n` (a test checks it). Tests: `backend/tests/test_sync_*.py`; test-only event types live in `tests/testapp/handlers.py`.
