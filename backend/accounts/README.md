# accounts

Users and authentication (issue #4): login, token pairs, device sessions, revocation, password reset. Read [`../README.md`](../README.md#authentication-4) and the rows "Auth endpoints", "Tokens", "Devices and revocation" of [`docs/api-conventions.md`](../../docs/api-conventions.md) first.

## Device table queries (#224)

`GET /devices/` searches label, serial, app_version and last_user.username;
username matching requires a membership in the device's organization (including
historical/inactive membership). The selector annotates this restricted search
source without expanding the device queryset. Sorting supports label, serial,
app_version, last_seen_at and created_at, with an ascending id tie-breaker before
pagination. Existing is_revoked/user filters and -created_at,id default remain;
user still means any historical scoped session. Details/revocation do not apply
list search/ordering. Exact queries: [configuration table contract](../../docs/api-conventions.md#configuration-table-queries-224).
Evidence: `tests/test_table_queries_224.py` covers later-page matches, stable
ascending/descending ordering and foreign device/user search isolation.

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
| Final upload (`consume_final_upload`) | All authentic prepared `User` rows, including the actor, in UUID order; then the existing actor/session consumption. Default opt-in views prepare only the actor. |
| Sync batch (`/field/sync/`) | Prepared sorted `User` closure, actor `Device`/`DeviceSession`/`TokenPair` when applicable, sorted existing source `FieldEvent`s, required `Organization`, courier advisory **try** locks, then domain rows. A final upload reuses already held actor/session locks. Lock timeout/deadlock roll back the batch and preserve the single final upload. |

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

`FinalUploadMixin` prepares bounded authentic source authors and custody participants outside
retained locks. The actor belongs to the same sorted User closure. Preparation is reused by the
sync transaction; a changed closure aborts with `429 sync_in_progress` before effects rather
than acquiring a newly discovered User after a session/domain lock. Reacquiring an already held
actor User does not introduce another lock level. No handler performs external I/O under locks.

Only closure acquisition has an inner savepoint. If its explicit retryable contention error
occurs, rollback releases partial User locks before a fresh, nonlocking read of the same real
DeviceSession and the canonical `is_final_upload_available` predicate. Fresh withdrawal or
absence returns `401 session_revoked` without spending; continued eligibility rethrows the
original `429` and headers. This fallback acquires no Device, Session or domain lock. Successful
acquisition enters the existing `consume_final_upload` exactly once. Its consumption and every
view effect share the outer transaction; failed responses roll both back. Expected preparation
errors from both APIException and DomainError families are deferred until that canonical fresh
eligibility check. Withdrawal returns401 first; an eligible session preserves the original error
and rollback. Unexpected exceptions propagate. The rule belongs to this single lifecycle,
independently of which expected error a bounded domain preparation discovers.
`authenticate_header` preserves bearer-only `401` answers.
