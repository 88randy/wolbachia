# shifts

The courier's shift ("jornada", issue #68): the day that frames all field work. Read [`docs/sync.md`](../../docs/sync.md) ("Shifts") for the event contract and codes, and [`../field_sync/README.md`](../field_sync/README.md) for the handler registry.

| Module | What lives there |
| --- | --- |
| `models.py` | `Motorcycle` (voidable fleet configuration), `MotorcycleBlockEvent` (insert-only audit), `Shift` and `MotorcycleCheck` (insert-only; a shift changes once, on close) |
| `payloads.py` | Payload serializers of `shift.open` and `shift.close` |
| `services.py` | Fleet create/update/void/unblock services; `open_shift` and `close_shift`: the apply functions (rules, writes, `EventRejected` / `EventNeedsReview`) |
| `handlers.py` | Registers both handlers from `AppConfig.ready()` (`checks_shift=False`: they are the shift) |
| `guard.py` | `check_event_shift`: what the pipeline does with the `shift_id` of any other event |
| `selectors.py` | `list_shifts` (filters), `highest_recorded_km` |
| `serializers.py`, `views.py`, `urls.py` | `GET /shifts/` and `GET /shifts/{id}/` (`shift.read`, read-only) |
| `codes.py`, `permissions.py` | Event types, result codes, permission code |

Rules for code here:

- Shifts are written only by the sync handlers. There is no `POST`, `PUT` or `DELETE`; nothing is deleted.
- `guard.py` is registered with `field_sync.registry.register_envelope_check` from `ShiftsConfig.ready()`; `field_sync` does not import `shifts`.
- A handler validates its own rules and raises `EventRejected` / `EventNeedsReview`; the partial unique indexes `shift_one_open_per_courier` and `shift_one_open_per_motorcycle` are only the backstop (and a reused shift id that loses a primary key race is caught in its own savepoint) (an `IntegrityError` would be a `500` for the whole batch).
- Row locks, in order: `Motorcycle` (open), `Shift` (close). Both come after the account locks of [`accounts/README.md`](../accounts/README.md).
- `shift.open` (#201) checks the current paired `field_event.sync` center grant before attempting a Motorcycle row lock, then rechecks the locked row and current grants before blocked/in-use checks. A denied row never waits for its lock and cannot reveal existence through `429 sync_in_progress`. Each check uses the shared single-statement `membership_snapshots` capture of membership and active profiles; no configuration lock is acquired. Unknown, foreign, voided and out-of-scope codes all return `motorcycle_unknown` with empty params. Unassigned motorcycles require explicit all-center sync scope; unrelated fleet permissions and quadrant scope never widen it. Pending events and final uploads use the server-side snapshot, never the phone's downloaded scope.
- A new result code needs a row in `docs/sync.md` and `sync.result.*` keys in both languages of `packages/i18n` (a test checks it).
- Fleet management (#72) lives in `motorcycle_views.py` and `motorcycle_serializers.py`: `GET/POST /motorcycles/`, `GET/PATCH /motorcycles/{id}/`, `POST .../void/`, `POST .../unblock/`. No delete. Contract and defaults: [API conventions](../../docs/api-conventions.md).
- Fleet writes lock Motorcycle, the same row as `shift.open`, before examining state; void refuses an open shift. Unblock writes the state and an insert-only `MotorcycleBlockEvent` atomically. Unblocking an unblocked motorcycle is `409 motorcycle_not_blocked` without another event. Severe-check blocks record their source field event. The database also refuses audit UPDATE/DELETE.
- Unique codes remain reserved after void. PostgreSQL arbitrates concurrent creates; only that constraint is mapped to `duplicate_code`. Creation accepts code/plate; PATCH accepts plate only; void/block metadata cannot be written through CRUD.
- `GET /field/catalog/` includes a compact `motorcycles` list (`list_snapshot_motorcycles`): blocked motorcycles/reasons remain visible, voided ones do not. Fleet content participates in the existing ETag and sync `catalog_version`. The snapshot keeps its `catalog.read` permission for organization configuration; `/motorcycles/` uses `motorcycle.read`.
- Admin gets manage/unblock/read/service_clear, supervisor gets read/unblock/service_clear, courier gets read. The service_clear grant authorizes inspection clearance of a named fault (#103). Existing permission seed bookkeeping preserves revocations and custom profiles.
- Motorcycle codes are immutable after creation: schema-1 offline events identify motorcycles only by code. PATCH rejects any supplied `code` (even unchanged) with `400 validation_error`, `fields.code: [{code: immutable_code, params: {}}]`; `update_motorcycle` rejects it too. No aliases. To correct a wrong code, void the motorcycle and create a new one with the correct code. The original code remains reserved, including after void, so a pending event cannot bind to a different motorcycle.
- [ASSUMPTION] Admin can also unblock, and void refuses an open-shift motorcycle. No new dependencies or seed fleet records.

Tests: `backend/tests/test_shift_*.py` (events, guard, API, concurrency), `test_motorcycle_*.py` (fleet contract, audit, isolation and races) and `test_seed_defaults.py` (default grants and preserved revocations).


## Fleet B-05 (#103)

Motorcycle now carries nullable organizations.Center and revision. Management
accepts/filters center within actor scope; unassigned motorcycles require an
explicit all-center grant. Read-only metrics are supplied by fleet through
extensions.py hooks, as are additional accepted odometers and legacy-unblock
inspection guards. No fleet module is imported by shifts at module level. Code
and field-catalog snapshot stay unchanged; PATCH now accepts plate and center.
Severe blocks, PATCH and unblock advance revision. fleet handles nested history,
fuel and named clear-fault routes; see ../fleet/README.md. A named clearance locks
the same Motorcycle as shift.open and never removes another active blocker.
# B-06 critical producer (#104)

The existing severe-check MotorcycleBlockEvent is enqueued as a minimal notice cause
after commit. Its original status/flags/audit remain authoritative and are not
duplicated into a reported Incident. Publication checks current scope and appends
deduplicated B-07 intents; no broker/mail/storage I/O runs under Motorcycle locks.
