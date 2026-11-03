TITLE: [Web] Users list and person record with masked RFC (W48, W49)
LABELS: web,backend,security

## 1. Context
Part of epic #24. Admins manage people of their organization, and personal data must stay minimal: the RFC is masked and revealing it is logged.

## 2. Goal
List, create, edit and deactivate users. A person record lets admins:
- view profiles, center, trainings and app version;
- reveal the RFC (logged);
- sign the person out of their phone.

## 3. Scope / Out of scope
**Scope:**
- W48 list with filters (profile, center, status, expired trainings);
- W49 record (Data tab, profiles, trainings summary, device);
- create / edit / deactivate;
- reveal RFC;
- revoke device sessions.

**Out of scope:** role matrix (W65); trainings catalog (W50); evaluations (W51).

## 4. Data model
- `User(name, rfc_encrypted, profiles[], center, status, organization_id)`.
- `AccessLog(actor, action="reveal_rfc", target, at, ip)`.

## 5. Contract (API / interfaces)
- `GET/POST/PATCH /api/v1/users/`
- `POST /api/v1/users/{id}/deactivate/`
- `POST /api/v1/users/{id}/reveal-rfc/`
- `POST /api/v1/users/{id}/revoke-device-sessions/`

## 6. Behavior
- RFC is shown masked everywhere.
- "Show" asks for confirmation, displays the value for that view only, and writes the access log.
- Deactivation keeps all records authored by the user.

## 7. Edge cases & errors
- RFC format validation server-side.
- Duplicate RFC inside the organization → `400`.
- An admin deactivating themselves as the last admin → `409`.
- User from another organization → `404`.

## 8. Acceptance criteria
- [ ] The full RFC never appears in list responses or the browser cache.
- [ ] Each reveal appears in W60.
- [ ] Automated cross-organization access test passes.

## Notes
- [PENDING] Which profiles can see the person record in limited mode (SUP?).
- [PENDING] RFC encryption-at-rest approach (backend security issue).
