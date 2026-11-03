TITLE: [Web] Egg count capture, keyboard and scanner first (W35)
LABELS: web,backend,priority:high

## 1. Context
Part of epic #21. The egg count is captured only here, by the entomologist; couriers never count. Counts feed every entomological index (W53).

## 2. Goal
Count a queue of bags quickly and without errors, using only the keyboard or scanner, with a full audit trail.

## 3. Scope / Out of scope
**Scope:**
- count queue from received bags;
- big numeric field with fixed focus;
- Enter saves and moves to the next bag;
- visible shortcuts;
- correction by void + new count;
- es-MX and en (the EN variant is designed).

**Out of scope:** recount rule and screen (W36, separate issue); dashboards.

## 4. Data model
`EggCount(bag_id, value int >= 0, counted_by, counted_at, attempt, voided_at, voided_by, void_reason)`. Append-only.

## 5. Contract (API / interfaces)
- `POST /api/v1/bags/{id}/counts/ { value }` → `201` with the count and `next_bag`.
- Voiding: `POST /api/v1/egg-counts/{id}/void/ { reason }`.

## 6. Behavior
- The current bag shows code, block, reading date and collector.
- Saving is optimistic only after server confirmation; the next bag loads after `201`.
- The shortcuts list is always visible.

## 7. Edge cases & errors
- Non-integer or negative input → inline error, focus stays.
- Value above a configurable plausibility limit → confirm step ([PENDING] rule parameter).
- Network error → the value is kept in the field, with a retry.
- Bag already counted by another user → `409`, show who and when.

## 8. Acceptance criteria
- [ ] Full flow works without a mouse; focus never leaves the field unexpectedly.
- [ ] Each count stores who and when, and shows in W4 history.
- [ ] Corrections never overwrite; a voided count stays visible.
- [ ] Layout survives +30 % text length in English.

## Notes
- [PENDING] Recount trigger (the field-vs-lab 10 % rule from the design no longer applies).
- [PENDING] Plausibility limit for counts (organization rule parameter).
