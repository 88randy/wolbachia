TITLE: [Design] P14: add "Does the paddle have eggs? Yes/No" step only when the paddle is present
LABELS: design

## 1. Context
Client decision: couriers do not count eggs (the entomologist does, on web), but they mark Yes/No when the paddle is present. Current design (Ronda 1) removed the egg step entirely.

## 2. Goal
Update P14 and prototype R2/R3 to include a Yes/No step after "How did you find it?" when a paddle exists.

## 3. Scope / Out of scope
**In:** P14 static board, R2, R3, English P14, dark mode sample. **Out:** egg count UI.

## 4. Data model
`ovitrap.check` payload gains `has_eggs: bool | null` (null when no paddle).

## 5. Contract
N/A.

## 6. Behavior
Shown only if finding ∈ {Ok, Knocked over, No water, Other with paddle}. Two large buttons; tapping advances.

## 7. Edge cases & errors
Finding "Sin papeleta" / "No está" / "Destruida" → step skipped.

## 8. Acceptance criteria
- [ ] Canvas updated; step count back to 6 when the step applies.

## Notes
Lab count remains authoritative for indices.
