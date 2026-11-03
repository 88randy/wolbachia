TITLE: [Web] Incident tray and incident detail (W6, W7)
LABELS: web,backend

## 1. Context
Part of epic #22. Incidents come from:
- mobile;
- lab reception (W34);
- discrepancies (W14);
- the review queue (W30);
- lot conditions (W18).

Their types, response times and escalation are configured per organization (W64).

## 2. Goal
Supervisors and coordinators can triage, act on and close incidents. Closing requires the evidence the incident's type asks for, and overdue incidents escalate automatically.

## 3. Scope / Out of scope
**Scope:**
- W6 tray with tabs ("My zone", others), critical items pinned, overdue items marked "Escalated";
- W7 detail with what it blocks, timer, thread, reassign, change severity, close with evidence, void.

**Out of scope:** incident type editor (W64, epic #23); the escalation job itself (backend issue).

## 4. Data model
`Incident(code, type, severity, status, owner, due_at, escalation_level, blocks[], evidence[], organization_id)` + `IncidentEvent` timeline.

## 5. Contract (API / interfaces)
See `docs/web-api-needs.md` § Incidents.

## 6. Behavior
- The timer shows the time left until `due_at`.
- Escalation changes the owner and adds a timeline event.
- The close button stays disabled, with the reason, until the required evidence is attached.

## 7. Edge cases & errors
- Concurrent edits → `409` with the current state.
- Incident type "Other" → the free-text description is required.
- An incident on a voided object → still visible, with a link marked "Voided".

## 8. Acceptance criteria
- [ ] Every number in the tray header opens the filtered list.
- [ ] Closing without the required evidence is impossible (UI and API).
- [ ] The full thread and events are visible in W7 and W4.

## Notes
- [PENDING] Escalation chain when the coordinator also overruns the time limit.
