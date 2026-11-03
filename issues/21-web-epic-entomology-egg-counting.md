TITLE: [Web] Epic: Entomology lab and egg counting
LABELS: web,epic

## 1. Context
Couriers collect ovitrap egg paddles but do **not** count eggs. Mobile only records whether the egg paddle is present and, if so, whether it has eggs (Yes/No). The entomologist receives the bags in the lab and captures the count in the web. Lab work also includes recounts, recycled paddles, UIEB shipments, Wolbachia results, biological write-offs and third-party material requests.

## 2. Goal
A lab workflow in the web, fast and keyboard-first, from bag reception to validated count and official shipment. Every action must be traceable.

## 3. Scope / Out of scope
**Scope:**

| Screen | What it covers | Issue |
|---|---|---|
| W34 | bag reception | #30 |
| W35 | egg count | #31 |
| W36 | recounts | — |
| W37 | recycled egg paddles | — |
| W38 | UIEB shipment / Annex VI | — |
| W39 | biological write-offs | — |
| W40 | Wolbachia results | — |
| W41 | third-party material requests | — |
| W42 | larval studies (optional module) | — |

**Out of scope:** mobile capture; the dashboards that consume counts (epic #25).

## 4. Data model
Proposed:
- `Bag`: code, reading, block, collector, `paddle_present`, `has_eggs`, status.
- `EggCount`: bag, value, counted_by, counted_at, attempt, voided.
- `Recount`, `EggPaperReuse`, `UiebShipment`, `WolbachiaSample`, `WolbachiaResult`, `MaterialRequest`, `LarvalSurvey`.
- All of them carry `organization_id`.

## 5. Contract (API / interfaces)
See `docs/web-api-needs.md` § Entomology lab.

## 6. Behavior
- Counts are append-only. A correction is a void with reason plus a new count.
- The history keeps every attempt.
- A third reuse of an egg paddle is not possible.

## 7. Edge cases & errors
- Bag scanned without a reading → incident.
- A bag expected but not received → "missing" incident.
- Duplicate scan → no new record.
- Egg paddle marked "not present" in mobile → no count expected; the bag is flagged.

## 8. Acceptance criteria
- [ ] W34–W41 implemented with their designed states.
- [ ] No UI or API path accepts an egg count from the courier.
- [ ] Every count shows who counted it and when, and is listed in the record history (W4).

## Notes
- [PENDING] Recount trigger. The design used "field vs lab difference > 10 %", which is no longer valid because there is no field count. Options: random sample %, second-person rule, or a count outside the expected range.
- [PENDING] Pupae index, IPP and ICPP formulas (CENAPRECE larval guide, Annex 5). Needed only for W42.
- [PENDING] Whether W42 ships in the first release.
