TITLE: [Web] Lab bag reception with continuous scan (W34)
LABELS: web,backend

## 1. Context
Part of epic #21. Bags with egg paddles arrive at the lab from the field. Mobile recorded only whether the egg paddle was present and, if so, whether it had eggs (Yes/No).

## 2. Goal
The entomologist receives bags by scanning their QR codes one after another, and each bag enters the count queue (W35).

## 3. Scope / Out of scope
**Scope:**
- continuous scan field (scanner or keyboard);
- received list showing bag code, block, reading, date, collector, `paddle_present` and `has_eggs`;
- "no reading" and "missing" flows that open an incident;
- received vs expected summary.

**Out of scope:** counting (#31); recounts.

## 4. Data model
`Bag` gains `received_at`, `received_by`, and `status` (`in_transit` → `received` → `counted` / `in_recount`).

## 5. Contract (API / interfaces)
`POST /api/v1/bags/receive/ { code }` returns:
- `200` with the bag; or
- `404` for an unknown code; or
- `409` when already received; or
- `422 no_reading`, which comes with the created incident's id.

## 6. Behavior
- Focus stays in the scan field.
- Each result is announced through a live region and shown at the top of the list.
- Duplicate scans do not create records.

## 7. Edge cases & errors
- Code from another organization → same response as unknown.
- Bag with `paddle_present = false` → received, flagged "no egg paddle", not added to the count queue.
- Scanner sends extra characters → the code is normalized client-side, validated server-side.

## 8. Acceptance criteria
- [ ] 20 bags can be received without touching the mouse.
- [ ] The UI shows no field egg count anywhere.
- [ ] Incidents created here appear in W6 with a link back to the bag.

## Notes
- The original design showed "field eggs" in this table. Replace it with `paddle_present` and `has_eggs`.
- [PENDING] Exact QR payload format (shared with mobile and W19 labels).
