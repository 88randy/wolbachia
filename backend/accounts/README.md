# accounts

Users and authentication (issue #4): login, token pairs, device sessions, revocation, password reset. Read [`../README.md`](../README.md#authentication-4) and the rows "Auth endpoints", "Tokens", "Devices and revocation" of [`docs/api-conventions.md`](../../docs/api-conventions.md) first.

## Personnel administration and protected RFC (#100 / B02)

`Personnel` belongs to one Membership and stores organization-private work context,
display name, work contact and the protected RFC envelope. It never edits the
shared User's credentials, global activity or other organizations' files.
`/users/{id}/` uses the **User UUID**; `personnel_id` identifies the private file
and `membership_id` identifies its organization membership.

| Route | Permission and behavior |
| --- | --- |
| `GET /users/`, `GET /users/{id}/` | `user.read`; no RFC value or cryptographic metadata. |
| `POST /users/` | `user.create`; supply an existing same-organization `membership_id` OR an unused `username`, plus `display_name`, `center_id` and optional `quadrant_id`, work contact and write-only `rfc`. |
| `PATCH /users/{id}/` | `user.update`; `expected_revision` is required. Identity/membership cannot change; old and proposed contexts both require authority. |
| `POST /users/{id}/deactivate/` | `user.deactivate`; `expected_revision` is required. End this membership and its device sessions atomically. |
| `POST /users/{id}/reveal-rfc/` | Independent `user.reveal_rfc`; no body, `{rfc}` reply with `Cache-Control: no-store`. |
| `GET /users/operational/` | `user.operational_read`; limited work projection described below. |
| `GET /access-log/` | `access_log.read`; cursor-paged immutable receipts under current scope. |

A new username creates an identity with an unusable password and a membership
with no profiles and default-deny scope. This is not an invitation or credential
delivery flow. Existing identities can only be selected through a membership in
the active organization; role/scope grants stay in the membership API. Foreign
membership, center, quadrant and out-of-scope target references answer opaque404.
Attaching a membership without a Personnel file requires an explicit `user.create`
grant with `all` centers and `all` quadrants. Later mutations also cover the
membership's whole effective paired scope, in addition to its work context.
One paired action/center/applicable-quadrant grant must cover each target. Admin
lists use page-number paging, `center`, `quadrant`, `is_active`, work-field search
and `display_name`/`created_at` ordering with a stable id tie.

Deactivation uses sorted User -> Device -> DeviceSession -> TokenPair locks before
Organization arbitration, sharing the existing last-administrator guard with
role and membership removal. It also withdraws already-revoked sessions' pending
final uploads. Other-organization membership/sessions, business authors and
original FieldEvents remain. Login rechecks current membership under the same
User lock, closing a login prepared before deactivation. Contention is retryable
429 `administration_in_progress`; stale CAS is409 `stale_revision`.

The operational projection exposes only User UUID, display name, current profiles,
center/applicable quadrant, membership activity, work contact, training summaries
and device id/label. Training rows additionally require current `training.read`
for their real context. It excludes RFC presence/value/envelope, identity
credentials, evaluations and issuer/evidence details. Supervisor/coordinator
defaults receive only `user.operational_read`; permission codes and current paired
scope, rather than profile names, enforce access. Regulatory permissions confer
no general personnel access.

`AccessLog` records actor, organization, private target UUID, action, original
center/quadrant, revision, server time, closed origin and result. Creation, update,
deactivation, reveal and rotation append receipts. There is no free-form origin,
request body, URL, RFC or contact data in the log. Reveal decrypts outside row
locks, then freshly checks identity, permission, context and unchanged revision
under locks. Its success receipt commits in a durable transaction **before**
plaintext is returned; an enclosing transaction is refused. Key/ciphertext,
authorization, revision, storage or commit failure returns no plaintext.

RFC reveal adds a per-user `THROTTLE_RFC_REVEAL_RATE` budget (default `30/hour`)
and create/PATCH bodies containing `rfc` share `THROTTLE_RFC_WRITE_RATE` (default
`10/hour`), in addition to global limits. Failed attempts consume the budget;
exhaustion returns429 `throttled` with `Retry-After`. Other work edits do not
consume it. Duplicate rejections durably append `rfc_rejected` receipts before
returning `rfc: rejected`; only current reveal authority receives `rfc: duplicate`.
Rejected creation receipts have a null target because no file was created. The
receipt retains actor/action/work context and never the candidate or matching file.

### External key configuration

| Setting | Purpose |
| --- | --- |
| `RFC_KMS_REGION` | AWS region for the KMS client. |
| `RFC_KMS_KEY_ID` | Symmetric KMS encryption key used by `GenerateDataKey` (`AES_256`). |
| `RFC_KMS_HMAC_KEY_ID` | Stable KMS HMAC key for `GenerateMac` (`HMAC_SHA_256`). |

All default to blank, making RFC operations fail closed with 503
`rfc_key_unavailable`. Credentials come from the deployment's standard AWS
identity; no application key material is configured in the repository. KMS
receives UUID/purpose context, never RFC plaintext. A generated 256-bit data key
and random 96-bit nonce encrypt locally with AES-256-GCM; authenticated data binds
organization and personnel UUIDs. Store ciphertext, nonce, wrapped data key and
the actual returned KMS KeyId. KMS-derived organization keys feed a local
HMAC-SHA256 of the normalized RFC; a database constraint prevents same-org
duplicates without creating cross-organization matches.

Internal `rotate_personnel_rfc` uses current `user.reveal_rfc`, CAS and a rotation
receipt. It decrypts using the retained old KeyId and encrypts with the current
wrapping key outside locks, preserving the duplicate fingerprint. Keep the HMAC
key stable across wrapping-key rotation; a changed fingerprint is refused. HMAC
key replacement requires a separately coordinated reindex. **[ASSUMPTION]** Real
external key custody, IAM policy and availability remain deployment verification.
No new FieldEvent, sync result code or client screen is introduced.

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
