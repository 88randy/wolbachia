TITLE: [Backend] Live shift positions over WebSocket (Channels) for W28
LABELS: backend,sync

## 1. Context
#5 ingests `location.ping` events while a shift is open and leaves the WebSocket fan-out out of scope. The web "Today's shifts" screen (W28) shows only open shifts and removes the dot when the shift closes.

## 2. Goal
Supervisors and coordinators see positions of open shifts of their organization and scope in near real time.

## 3. Scope / Out of scope
**In:** Django Channels consumer served by Daphne, Redis channel layer, authentication with the web session cookie, organization and scope filtering, group per organization, message on ping accepted and on shift close.
**Out:** position history (served by the `/shifts/{id}/` track, #5 and web epic #22), mobile changes.

## 4. Data model
No new tables. Reads the last accepted `location.ping` per open shift.

## 5. Contract (API / interfaces)
- `wss://<host>/ws/v1/live-shifts/` (path proposal; final in the PR and in `docs/api-conventions.md`).
- Server → client: `{ "type": "position", "shift_id", "courier_id", "lat", "lng", "accuracy_m", "device_time" }` and `{ "type": "shift_closed", "shift_id" }`.
- Initial state: `GET /api/v1/shifts/?status=open` (REST), then live updates.

## 6. Behavior
- Only users with the live-view permission connect; others are rejected with close code 4403.
- A user only receives positions inside their organization and scope.
- No positions are sent once a shift is closed.

## 7. Edge cases & errors
- Session expired → close code 4401; the web reconnects after sign-in.
- Late ping arriving after shift close → not broadcast.
- Redis unavailable → REST still works; the web shows "live view unavailable".

## 8. Acceptance criteria
- [ ] Tests: org isolation, scope filtering, no broadcast after close, rejected anonymous connection.
- [ ] Message rate bounded by the configured ping frequency.

## Notes
[PENDING] Ping frequency and retention (privacy: only during an open shift), also listed in #5. Default as a rule parameter until the client decides.
