# accounts

Users and authentication (issue #4): login, token pairs, device sessions, revocation, password reset. Read [`../README.md`](../README.md#authentication-4) and the rows "Auth endpoints", "Tokens", "Devices and revocation" of [`docs/api-conventions.md`](../../docs/api-conventions.md) first.

| Module | What lives there |
| --- | --- |
| `services.py` | Login (`verify_credentials`, `authenticate_user`), `start_device_session`, `reset_password` |
| `token_pairs.py` | Issuing and rotating `TokenPair`s, reuse and sibling rules |
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
| Final upload (`consume_final_upload`) | `User`, `DeviceSession` |
| Sync batch (`/field/sync/`, #5) | none of the above in a normal request; in a final upload it runs inside the `User` and `DeviceSession` locks above. Its per-device serialization is a PostgreSQL advisory lock (not a row lock), taken after them |

Bookkeeping (`touch_session`, the first-use mark of a lone pair) are single statements outside any transaction of ours. `tests/test_credentials_and_locks.py` runs refresh, login and final upload against reset on threads (`transaction=True`) to catch a deadlock.

Revocation and rotation commit before they raise, so they must not run inside an outer `atomic()`; `ATOMIC_REQUESTS` stays off.

## `/field/sync/` (#5)

`FinalUploadMixin` holds the `User` and `DeviceSession` locks for the whole view when a revoked phone makes its final upload: sync batches are bounded (`SYNC_MAX_EVENTS`, `SYNC_MAX_BODY_BYTES`) and no handler or pipeline code calls an external service (HTTP, storage, email). The batches of one device are serialized with `pg_advisory_xact_lock`, not with a `Device` row lock: a row lock taken after the session lock would run against the order above, and it would block the `Device.last_seen_at` update that every authenticated request does. `authenticate_header` makes a bearer-only view answer a request without credentials `401` (not `403`).
