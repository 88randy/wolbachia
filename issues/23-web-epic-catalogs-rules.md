TITLE: [Web] Epic: Catalogs and rules per organization
LABELS: web,epic

## 1. Context
Rules and catalogs are configured per organization. Examples: minimum distance (50 m), maximum speed (10 km/h), incident types, motorcycle checklist, reasons, intervention types. Editing lives in the web (W62–W64).

## 2. Goal
Admins can change rules and catalogs without a deploy. Changes are versioned, have an effective date and never overwrite history.

## 3. Scope / Out of scope
**Scope:**
- W62 versioned rule parameters (#36);
- W63 catalogs (#35);
- W64 incident types;
- W8 supply catalog (shared component).

**Out of scope:** the role matrix (epic #24); the backend rule engine itself (backend issue).

## 4. Data model
Proposed:
- `RuleParameter(key, unit, organization_id)` + `RuleParameterVersion(value, effective_from, created_by, reason)`.
- `Catalog(slug)` + `CatalogItem(code, label_i18n, active, is_other)`.
- `IncidentType` (severity, owner role, response time, escalation, blocks, required evidence).

## 5. Contract (API / interfaces)
See `docs/web-api-needs.md` § Configuration.

## 6. Behavior
- Editing a parameter creates a new version with a before/after view.
- Items in use are deactivated, never deleted.
- Every open catalog has a fixed "Other (specify)" item that requires free text where it is used.

## 7. Edge cases & errors
- An effective date in the past is not allowed (or needs an explicit reason; [PENDING]).
- Two versions with the same effective date → `400`.
- Deactivating "Other" → `409`.

## 8. Acceptance criteria
- [ ] No threshold used by web or mobile is hard-coded; all are read from `/rule-parameters/`.
- [ ] Every open catalog ends with "Other (specify)".
- [ ] Version history is visible and read-only.

## Notes
- [PENDING] The design shows parameters "per region" (W62). The decision is per organization. Is a regional override needed?
- [PENDING] How mobile gets parameter changes (sync on login, push, periodic).
