# accounts

Users and authentication (issue #4): login, token pairs, device sessions, revocation, password reset. Read [`../README.md`](../README.md#authentication-4) and the rows "Auth endpoints", "Tokens", "Devices and revocation" of [`docs/api-conventions.md`](../../docs/api-conventions.md) first.

| Module | What lives there |
| --- | --- |
| `services.py` | Login (`verify_credentials`, `authenticate_user`), `start_device_session`, `reset_password` |
| `token_pairs.py` | Issuing and rotating `TokenPair`s, reuse and sibling rules |
| `token_retention.py` | Bounded whole-family pruning after effective session end (#54); session audit rows remain |
| `tasks.py` | Celery orchestration for password reset email and nightly token-pair retention |
| `revocation.py` | Revoking sessions and devices, the single final upload |
| `authentication.py` | `DeviceBearerAuthentication` (rejects only; never writes a revocation) |
| `final_upload.py` | `FinalUploadMixin` for views that accept a revoked phone's last upload |
| `request_context.py` | The only reader of `X-Organization` |

## Row lock order

Every code path that locks several rows takes them in this single global order, and may skip a level but never goes backwards:

1. `User`
2. `Device`
3. `DeviceSession`
4. `TokenPair` (a parent pair right after its child)
5. Sync courier advisory **try** lock, then handler/domain row locks for the event
6. `RejectionQuotaCounter` (#56), only inside the rejection savepoint, after any handler locks of that event

User rows are locked with `select_for_update(no_key=True)` (`FOR NO KEY UPDATE`): that still serializes login, refresh, password reset and the final upload of one user, but does not block the foreign-key checks (`FOR KEY SHARE`) of inserts that reference the user. Refresh locks the user before the session for the same reason: inserting a `TokenPair` takes `KEY SHARE` locks on the rows it references.

| Path | Locks, in order |
| --- | --- |
| Password check with hash upgrade (`verify_credentials`) | none for the slow hash check; `User` only to save the upgraded hash |
| Login (`start_device_session`) | `User`, `Device`, the user's sessions on that device |
| Refresh (`rotate_refresh_token`) | `User`, `DeviceSession`, `TokenPair`, parent `TokenPair` |
| First use of a sibling's access token (`claim_access_use`) | `User`, `DeviceSession`, parent `TokenPair` |
| Password reset (`reset_password`) | `User`, the user's active sessions |
| Revoke a user's sessions | `User`, the sessions |
| Revoke a device | `Device`, the device's sessions |
| Token-family retention (`prune_ended_token_pairs`) | `DeviceSession` only, then delete its `TokenPair` family; re-check eligibility under the lock, never acquire `User` or `Device` afterwards |
| Final upload (`consume_final_upload`) | `User`, `DeviceSession` |
| Sync batch (`/field/sync/`, #5) | none of the above in a normal request; in a final upload it runs inside the `User` and `DeviceSession` locks above. Its serialization starts with a PostgreSQL advisory transaction lock (not a row lock), taken after them: first a *try* lock per (organization, user) (never waits: a second batch is `429 sync_in_progress`), then `SET LOCAL lock_timeout` (`SYNC_LOCK_TIMEOUT_MS`) for the rest of the transaction: any other wait (a primary key insert on an id another batch holds, a void target row, a rejection quota counter row) ends in `429 sync_in_progress` after the timeout, and a deadlock (`40P01`) does too |

Quota lock details (#56): the counter claim is a conditional increment after `get_or_create` under
`EventProcessor._reject`'s savepoint. A duplicate id rolls the claim back; a whole-batch timeout
also discards on-commit threshold alerts. No code after the counter explicitly locks a user,
device, session or token row. A rejected handler's savepoint has already rolled back; earlier
successful events may retain domain locks and later events may take their own handler locks,
with the existing timeout/deadlock rollback policy bounding such waits. One authenticated device
and one receipt-local day per batch imply at most one counter row, so quota-only reverse-order
cycles over different devices/days cannot occur. Shared-device couriers serialize claims on that
one row. Deferred foreign-key checks are still run inside the batch error mapping. Full contract:
[`docs/sync.md`](../../docs/sync.md#atomic-claims-and-lock-order).

Bookkeeping (`touch_session`, the first-use mark of a lone pair) are single statements outside any transaction of ours. `tests/test_credentials_and_locks.py` runs refresh, login and final upload against reset on threads (`transaction=True`) to catch a deadlock.

Revocation and rotation commit before they raise, so they must not run inside an outer `atomic()`; `ATOMIC_REQUESTS` stays off.

## `/field/sync/` (#5)

`FinalUploadMixin` holds the `User` and `DeviceSession` locks for the whole view when a revoked phone makes its final upload: sync batches are bounded (`SYNC_MAX_EVENTS`, `SYNC_MAX_BODY_BYTES`) and no handler or pipeline code calls an external service (HTTP, storage, email). The batches of one courier are serialized with `pg_try_advisory_xact_lock` on (organization, user) and every later wait is capped by a lock timeout, not by more locks: a `Device` row lock taken after the session lock would run against the order above, and it would block the `Device.last_seen_at` update that every authenticated request does. The user lock is a try, so it never waits while holding the `User` and `DeviceSession` rows of a final upload; other waits last at most `SYNC_LOCK_TIMEOUT_MS` (then `429 sync_in_progress`, and the final upload is given back), so a final upload never waits long while holding those rows. `authenticate_header` makes a bearer-only view answer a request without credentials `401` (not `403`).
