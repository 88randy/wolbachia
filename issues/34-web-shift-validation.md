TITLE: [Web] Shift validation: approve or observe with reason (W29)
LABELS: web,backend

## 1. Context
Part of epic #22. A courier closes their shift in mobile, and the supervisor validates it in the web.

## 2. Goal
The supervisor reviews a closed shift (summary + timeline on the map) and either approves it or observes it with a reason. An observation returns the shift to the courier.

## 3. Scope / Out of scope
**Scope:**
- W29 summary: points visited, readings, egg paddle present + has eggs Yes/No, incidents, distance, flags;
- map timeline (MapLibre + OSM attribution);
- Approve / Observe actions.

**Out of scope:** live map (W28); review queue (W30).

## 4. Data model
`Shift.status` moves from `closed` to either `approved` or `observed`. Observations are stored as `ShiftObservation(reason, by, at)`.

## 5. Contract (API / interfaces)
- `GET /api/v1/shifts/{id}/`
- `POST /api/v1/shifts/{id}/approve/`
- `POST /api/v1/shifts/{id}/observe/ { reason }`

## 6. Behavior
- Flags come from organization rule parameters (e.g. distance > 50 m to the point, speed > 10 km/h); the UI shows the threshold used and its version.
- Observing notifies the courier.

## 7. Edge cases & errors
- Shift still open → actions disabled with the reason.
- Already approved by someone else → `409`.
- Track missing (no GPS) → shown as a gap, not hidden.

## 8. Acceptance criteria
- [ ] The map has a keyboard-accessible list alternative of the timeline.
- [ ] Observe requires a reason.
- [ ] The decision appears in the shift history and in W4 of each affected point.

## Notes
- [PENDING] Whether approval can be partial (per point) or only per shift.
