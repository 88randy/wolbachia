TITLE: [Web] Epic: Users, roles and organizations
LABELS: web,epic,security

## 1. Context
There is one database, isolated by `organization_id`, and each user only sees their organization's data. People screens (W48–W51), the role matrix (W65), API keys (W66), mobile versions (W67) and organization settings (W68) live in the web. Privacy screens (W58–W61) depend on the same identity model.

## 2. Goal
Admins manage people, roles, trainings and organization settings safely, with minimal personal data and an access log.

## 3. Scope / Out of scope
**Scope:**
- W48–W51 (users list and person record in #37);
- W65 roles;
- W66 API keys;
- W67 mobile versions;
- W68 organization;
- W58–W61 privacy (ARCO, transfers, access log, retention).

**Out of scope:** creating organizations from the web (platform operator task, [PENDING]); SSO.

## 4. Data model
Proposed:
- `User`: masked RFC; reveal logged in `AccessLog`.
- `Role` + `RolePermission(scope)`, `Training`, `UserTraining`, `Evaluation`, `ApiKey` (hashed secret), `MobileRelease`, `Device`.
- `ArcoRequest`, `DataTransferAuthorization`, `RetentionPolicy`, `RetentionRun`.

## 5. Contract (API / interfaces)
See `docs/web-api-needs.md` § People and community, § Regulatory / privacy, § Configuration.

## 6. Behavior
- Users are deactivated, never deleted.
- Revealing the RFC is an explicit, logged action.
- API key secrets are shown once.
- External roles (Government) are fixed and read-only.

## 7. Edge cases & errors
- An admin removing their own last admin permission → `409`.
- Lost phone → "Sign out on their phone" revokes device sessions.
- Cross-organization ids → `404`.

## 8. Acceptance criteria
- [ ] Automated test: a user of org A gets `404` on every detail endpoint for an object of org B.
- [ ] Every RFC reveal and personal-data export appears in W60.
- [ ] RFC is masked in every list and export unless a valid transfer authorization exists.

## Notes
- [PENDING] ARCO legal deadline (the design used 20 business days as a sample value; legal must confirm).
- [PENDING] Evaluation sheet section weights (W51).
- [PENDING] Final profile list (see #20).
