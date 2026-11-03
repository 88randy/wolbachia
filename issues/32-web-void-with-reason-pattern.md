TITLE: [Web] Void-with-reason pattern (no deletes)
LABELS: web,backend,spec

## 1. Context
Nothing is deleted: correcting = voiding with a reason. This rule applies to every business object the web touches.

## 2. Goal
One consistent way to void records across the web and the API, and to display voided records.

## 3. Scope / Out of scope
**Scope:**
- shared "Void" dialog (reason required, with a minimum length);
- display of voided state in tables, records and history;
- the API convention for voiding.

**Out of scope:** retention-driven anonymization (W61, privacy issue).

## 4. Data model
Voidable models get:
- `voided_at`;
- `voided_by`;
- `void_reason`;
- an optional `replaced_by`.

## 5. Contract (API / interfaces)
`POST /api/v1/<resource>/{id}/void/ { reason }` responds with:
- `200` and the voided object; or
- `409` if it cannot be voided (with `blocked_by`); or
- `403` without permission.

No `DELETE` endpoints on business data.

## 6. Behavior
- Voided records disappear from default lists, but appear with "Include voided" and always in history (W4) and search (W3), marked "Voided".
- Dashboards exclude voided records and list them under exclusions.

## 7. Edge cases & errors
- Voiding an object others depend on (e.g. a count used in an exported report) → allowed, flagged in the export history; or `409` ([PENDING] per object type).
- Double void → `409`.

## 8. Acceptance criteria
- [ ] No delete button or `DELETE` call in the web codebase (lint/grep check in CI).
- [ ] Dialog is accessible (focus trap, labelled, error messages).
- [ ] Void events show in W4 with author, time and reason.

## Notes
- [PENDING] Minimum reason length; whether reasons come from a catalog + "Other (specify)" or are free text.
