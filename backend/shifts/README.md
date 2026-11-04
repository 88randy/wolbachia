# shifts

The courier's shift ("jornada", issue #68): the day that frames all field work. Read [`docs/sync.md`](../../docs/sync.md) ("Shifts") for the event contract and codes, and [`../field_sync/README.md`](../field_sync/README.md) for the handler registry.

| Module | What lives there |
| --- | --- |
| `models.py` | `Motorcycle` (fleet configuration), `Shift` and `MotorcycleCheck` (insert-only; a shift changes once, on close) |
| `payloads.py` | Payload serializers of `shift.open` and `shift.close` |
| `services.py` | `open_shift` and `close_shift`: the apply functions (rules, writes, `EventRejected` / `EventNeedsReview`) |
| `handlers.py` | Registers both handlers from `AppConfig.ready()` (`checks_shift=False`: they are the shift) |
| `guard.py` | `check_event_shift`: what the pipeline does with the `shift_id` of any other event |
| `selectors.py` | `list_shifts` (filters), `last_known_km` |
| `serializers.py`, `views.py`, `urls.py` | `GET /shifts/` and `GET /shifts/{id}/` (`shift.read`, read-only) |
| `codes.py`, `permissions.py` | Event types, result codes, permission code |

Rules for code here:

- Shifts are written only by the sync handlers. There is no `POST`, `PUT` or `DELETE`; nothing is deleted.
- `guard.py` is registered with `field_sync.registry.register_envelope_check` from `ShiftsConfig.ready()`; `field_sync` does not import `shifts`.
- A handler validates its own rules and raises `EventRejected` / `EventNeedsReview`; the partial unique indexes `shift_one_open_per_courier` and `shift_one_open_per_motorcycle` are only the backstop (and a reused shift id that loses a primary key race is caught in its own savepoint) (an `IntegrityError` would be a `500` for the whole batch).
- Row locks, in order: `Motorcycle` (open), `Shift` (close). Both come after the account locks of [`accounts/README.md`](../accounts/README.md).
- A new result code needs a row in `docs/sync.md` and `sync.result.*` keys in both languages of `packages/i18n` (a test checks it).
- The `Motorcycle` table has no API or admin yet (a seed or a later issue creates them); the clearing of a motorcycle blocked by a severe check is also a later issue.

Tests: `backend/tests/test_shift_*.py` (events, guard, API, concurrency).
