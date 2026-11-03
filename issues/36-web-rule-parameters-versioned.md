TITLE: [Web] Versioned rule parameters per organization (W62)
LABELS: web,backend

## 1. Context
Part of epic #23. Thresholds such as the 50 m minimum distance, the 10 km/h maximum speed and the revisit frequency are configurable per organization. Editing never overwrites a value; it creates a new version with an effective date.

## 2. Goal
Admins change a parameter with a before/after comparison and an effective date, and anyone can see which version applied on any date.

## 3. Scope / Out of scope
**Scope:**
- parameter list (key, unit, current value, effective since);
- edit as a new version;
- version history.

**Out of scope:** how mobile receives the new values ([PENDING], backend/mobile issue).

## 4. Data model
- `RuleParameter(key, unit, min, max, organization_id)`.
- `RuleParameterVersion(value, effective_from, created_by, reason)`.

## 5. Contract (API / interfaces)
- `GET /api/v1/rule-parameters/`
- `GET /api/v1/rule-parameters/{key}/versions/`
- `POST /api/v1/rule-parameters/{key}/versions/ { value, effective_from, reason }`

## 6. Behavior
- Values are validated against min/max.
- Records evaluated by a rule store the version used, so later changes do not rewrite history.

## 7. Edge cases & errors
- `effective_from` in the past → rejected (or allowed with reason; [PENDING]).
- A version already scheduled for the same date → `400`.
- Value out of range → inline error.

## 8. Acceptance criteria
- [ ] No threshold is hard-coded in web or mobile.
- [ ] History is read-only and shows author, reason and dates.
- [ ] Journey R9 (revisit frequency 7 → 6 days) works end to end.

## Notes
- [PENDING] The design labels this screen "per region". Confirm whether there is a regional override inside an organization.
- [PENDING] Initial parameter list and units.
