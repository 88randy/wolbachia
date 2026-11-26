TITLE: feat: restore closure blocker references and rubric version in evaluation history
LABELS: enhancement

## 1. Context
The fast-mode web redesign removed two details that entomologists and supervisors need. The owner decided on 2026-11-26 to restore them:
- **W33 quadrant closure:** each closure blocker used to print its reference. The API only sends opaque UUIDs today (`id`, plus an always-empty `link`), so a person cannot tell which ovitrap or incident blocks the closure.
- **W51 evaluation history:** the rubric version was removed. Scores from different rubric versions are not comparable. The API only sends `rubric_version_id` (UUID).

The third restored item, the review receipt SHA-256, needed only web changes and shipped in develop with #375.

## 2. Objective
Show a human, actionable reference for every visible closure blocker, and the rubric version number on every evaluation history row.

## 3. Scope / out of scope
**In scope:**
- backend: the readiness blocker payload and `EvaluationRead`;
- `packages/api-client` regeneration;
- web: W33 and W51;
- i18n;
- tests.

**Out of scope:**
- new filters on the relocation or review lists;
- changes to who can close a quadrant.

## 4. Data model
No migrations. The data comes from existing fields: `Ovitrap.code`, `Incident.code` and `EvaluationRubricVersion.version`.

## 5. Contract
- `ClosureBlocker` gains `code: string` (optional; absent for hidden causes).
- The existing `link` gains a value when there is a record route for the cause:
  - `incident_quadrant_closure` → `/incidents/<code>`;
  - any other cause → empty `link`.
- Each cause takes its code from:
  - `removal_unconfirmed` → the ovitrap code;
  - `removal_unrecovered` and `relocation_pending` → the ovitrap code of the attempt or proposal;
  - `removal_review_pending` and `relocation_review_pending` → the ovitrap code resolved from the source event;
  - `incident_quadrant_closure` → the incident code.
- `EvaluationRead` gains a read-only `rubric_version_number: int`.

## 6. Behavior
- **W33:** each blocker shows "Referencia: OVT-0123". When `link` is not empty, the reference is a link.
- **W51:** each history row shows a "v{n}" badge next to the score, with an accessible name ("Rubric version 2").

## 7. Edge cases and errors
- **Hidden causes:** when the reader lacks the cause's read permission, `geography.decisions.scope.blocker` already strips the cause. It must also strip `code`, and the UI then shows no reference. Test both sides of that permission.
- **Unknown code:** when the ovitrap code cannot be resolved (for example, a label that was never placed), the API omits `code` and does not fail.
- **Coalescing:** distinct visible causes must stay distinct after coalescing.

## 8. Acceptance criteria
- [ ] Backend tests cover a code for every blocker reason, a hidden cause without a code, and `rubric_version_number`.
- [ ] The OpenAPI client is regenerated from the backend, not edited by hand.
- [ ] W33 test: the reference is visible, and the incident reference links to the incident.
- [ ] W51 test: the version badge has an accessible name.
- [ ] CI is green.

## Notes
- Risk is high: the change touches per-permission visibility of closure causes, so review follows CLAUDE.md point 4.
- Follow-up to the #375 CI hardening.
