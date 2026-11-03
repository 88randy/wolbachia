TITLE: [Web] Epic: Supervision and approvals
LABELS: web,epic

## 1. Context
Supervisors and coordinators watch field work, validate shifts, resolve flagged records, approve relocations, run incidents and close quadrants. These screens are W6–W7 and W28–W33, plus their links to inventory (W13–W16).

## 2. Goal
Supervisors must be able to:
- see what needs attention;
- decide on it (approve, observe, void with reason, open an incident);
- leave a full audit trail.

## 3. Scope / Out of scope
**Scope:**
- W6–W7 incidents (#33);
- W28 live shifts;
- W29 shift validation (#34);
- W30 review queue;
- W31 relocations;
- W32 third-party interventions;
- W33 quadrant closure;
- W25–W26 assignment and scheduling.

**Out of scope:** incident type configuration (epic #23); mobile flows.

## 4. Data model
Proposed:
- `Shift`: status open/closed/approved/observed, track.
- `ReviewItem`: rule, evidence, decision.
- `Relocation`: old/new location, photo, decision.
- `Incident`: type, severity, owner, due_at, escalation_level, blocks.
- `ThirdPartyIntervention`, `QuadrantClosure`.

## 5. Contract (API / interfaces)
See `docs/web-api-needs.md` § Incidents and § Operations / supervision. Live positions use Django Channels (path [PENDING]).

## 6. Behavior
- **Observe** returns a shift to the courier with a reason.
- **Rejecting a relocation** creates a next-day task.
- **Overdue incidents** escalate automatically; the configured response time and escalation target come from the incident type.
- **Closure** is blocked while an ovitrap is "Not recovered" or its removal is unconfirmed.

## 7. Edge cases & errors
- Two supervisors act on the same item: the second one gets `409` and sees the current state.
- A courier still offline when the shift is observed: the observation waits in their queue.

## 8. Acceptance criteria
- [ ] Each decision requires the designed inputs (reason, evidence).
- [ ] Each decision creates a timeline event visible in W4.
- [ ] Live map only shows open shifts, and a shift disappears when it closes.
- [ ] Blocked actions show reason and who unblocks them.

## Notes
- [PENDING] Coordinator as its own profile or SUP scope.
- [PENDING] Which system rules feed the review queue (W30). Use the organization-configurable thresholds (e.g. 50 m, 10 km/h).
