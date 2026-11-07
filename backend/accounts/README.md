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
| `session_audit_retention.py` | Truthful end proof, bounded direct session-person unlinking and finite operator holds (#181) |
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
| Session audit dissociation / explicit operator hold | `DeviceSession` only; fresh eligibility/hold checks under the same row lock; no late User/Device lookup |
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

## Session-end audit (#181)

The existing 03:30 UTC single-beat task first prunes #54 families, then runs a separate
capped session-audit pass. Pruning eligibility/deletion stays unchanged; before the
family disappears, the same locked transaction records its end basis/time/reason.
For natural expiry this is the maximum access/refresh expiry over ALL pairs. For
revocation it is the conservative later of revoked_at plus the configured final-upload
window and final_upload_deadline, even after use/cancellation. This is not a claim
about observed user activity. Already-pruned unrevoked legacy families have unknown
ended_at and a real cutover observation as retention_anchor; no timestamp is guessed.

`AUTH_SESSION_AUDIT_RETENTION_DAYS` defaults to 365, must be an integer >=180 and >=
the token-family period. Strictly older anchors qualify; equality remains retained.
Each of at most 500 candidates is rechecked under its Session lock: proof, elapsed
retention, no tokens, no active hold and no previous dissociation. The routine logs
candidate/dissociated/skipped counts, not people or token data. Duplicate runs are safe.

Dissociation preserves the row, device/org identity, normal row timestamps, end proof
and revocation reason/time, while clearing user/created_by/revoked_by, usage/final-upload
detail and unnecessary hold reference. No replacement identity is stored. Device.last_user,
Device actors, business authors and existing auth logs are separate retained data:
this is session-row unlinking, NOT irreversible global anonymization. Review snapshots
retain scalar observed session/pair UUIDs and their original author/configuration proof;
historical authority does not resolve the erased Session.user.

SQL guards forbid deletion, credential reattachment and person/authority restoration
after terminal proof/dissociation. Fresh issuance rechecks under the Session lock;
nullable auth/refresh/logout/final-upload fail closed. `touch_session` cannot refill
an ended row from an old object. No user is inferred from Device.last_user.

Trusted backend operators may use the following commands (not an HTTP endpoint,
Django admin or a new application permission). All identifiers below are synthetic
argument placeholders; this documentation does not authorize operating on real data:

```text
python manage.py session_audit --organization <org-uuid> --session <session-uuid> --state dissociated
python manage.py session_audit_hold --organization <org-uuid> --session <session-uuid> --purpose security_investigation --reference <opaque-case-uuid> --until <aware-ISO-instant>
python manage.py session_audit_hold --organization <org-uuid> --session <session-uuid> --purpose security_investigation --reference <same-case-uuid> --release
```

Hold/release is dry-run unless `--apply` is explicitly supplied. Each activation or
renewal must be in the future and within 90 days of that action; there is no automatic
renewal. Release must match the current opaque reference. Purpose/reference/time
describe an operator-attested investigation, not an app-certified external case.
Applied operator actions use the existing auth trail with opaque session/case and
organization identifiers, never a restored subject; routine retention logs are counts
only. Holds delay only #181 unlinking, not #54 token pruning, and cannot restore an
already dissociated identity. The query emits only the scoped minimal audit; lack of
end proof is `unclassified`, never implied live authority. Public Device fields stay
unchanged. Schema reversal refuses after any removed identity would need restoration.

`test_token_retention.py` owns policy/locked lifecycle/batch/task behavior;
`test_device_models.py` owns resurrection denial; `test_device_admin.py` owns operator
and historical-device filtering; the one whole `test_session_audit_migrations_181.py`
module owns real upgrade/reverse. SQL/concurrency require PostgreSQL CI; DB-free
settings/policy or collection does not qualify them. The periods are engineering
policy under delegated authority, not a statement of law.
