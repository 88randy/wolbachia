TITLE: [Backend] Notify couriers/supervisors of rejected or critical field events
LABELS: mobile,backend

## 1. Context
#5 stores every rejected or in_review field event and creates a `ReviewItem` that supervisors see in W30. Nobody is told actively: the courier only sees the result in the P28 inbox on the next sync, and a supervisor must open the review queue. Critical events (e.g. `emergency.accident`, a release recorded with a suspended permit) need a timely alert.

## 2. Goal
Notify couriers and supervisors when a field event is rejected, lands in review, or is critical, without user-facing text in the API.

## 3. Scope / Out of scope
**In:** a notification record per recipient, generation on `ReviewItem` creation and on critical event types, a cursor list for the web and for the phone (sync `changes`), read state.
**Out:** the review decisions (#22), the WebSocket live map (#19), email or SMS unless the channel decision selects them.

## 4. Data model
Proposed: `Notification` (OrgScoped, insert-only except `read_at`): `recipient` (user), `kind` (`event_rejected | event_in_review | critical_event`), `code`, `params`, `field_event` (FK), `review_item` (nullable FK), `created_at`, `read_at`.

## 5. Contract (API / interfaces)
Proposed:
- `GET /api/v1/notifications/` (cursor paging, `?is_read=`).
- `POST /api/v1/notifications/{id}/read/`.
- Sync `changes.notifications` for the phone.

Channel (in-app only, push, email) **[PENDING]**.

## 6. Behavior
- A rejected or in_review event notifies its courier and the supervisors in scope of that courier.
- Critical event types notify supervisors immediately. The list of critical types comes from configuration **[PENDING]**.
- Messages are `code` + `params`, translated by `packages/i18n`.

## 7. Edge cases & errors
- Recipients of another organization are never notified.
- A duplicate event (same id) does not notify twice.
- A courier without a supervisor in scope: only the courier is notified.

## 8. Acceptance criteria
- [ ] Rejected and in_review events create notifications for the courier and the supervisors in scope.
- [ ] Critical events notify supervisors.
- [ ] Organization isolation and idempotency tests.
- [ ] `docs/` updated and `packages/api-client` regenerated.

## Notes
- Depends on #5. Split out of #5 by decision (see the #5 plan comment).
- [PENDING] Notification channel (in-app, push via FCM or the internal update server, email).
- [PENDING] Which event types are critical, and the supervisor scope rule (center, quadrant).
