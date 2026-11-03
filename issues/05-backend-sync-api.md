TITLE: [Backend] Field sync API: idempotent event batches, server validation and review states
LABELS: backend,sync,priority:high

## 1. Context
Field capture is offline. Records are immutable; corrections are void events. The server revalidates rules (e.g. a release recorded offline with a suspended permit). Web screens consume the resulting data: review items (W30), bag reception (W34), relocations (W31), shifts (W28–W29), reconciliations (W16), live positions (W28).

## 2. Goal
`POST /api/v1/field/sync/` ingests batches idempotently, applies them to domain models, returns per-event results and pulls downstream changes for the phone.

## 3. Scope / Out of scope
**In:** event envelope, idempotency, validator registry, clock-skew review, pull changes, photo upload URLs, location pings for live shifts, notifications on rejections/critical events.
**Out:** domain models per feature (each epic registers its validator); WebSocket fan-out (#19).

## 4. Data model
`FieldEvent` (OrgScoped, immutable): id (client uuid), type, schema_version, payload JSON, device_id, user_id, shift_id, device_time, server_received_at, gps {lat, lng, accuracy_m}, rules_version, catalog_version, manual_capture, voids_event_id, status (accepted | rejected | in_review), status_code (stable machine code), status_params (JSON for the message).
A rejected / in_review event creates a `ReviewItem` for the web (W30).

## 5. Contract (API / interfaces)
`POST /api/v1/field/sync/`
```json
{ "device_id": "...", "cursor": "...", "events": [ { "id": "uuid", "type": "ovitrap.check", "device_time": "...", "payload": {} } ] }
```
→
```json
{ "server_time": "...", "results": [ {"id": "uuid", "status": "accepted|rejected|in_review", "code": "...", "params": {}} ],
  "changes": { "cursor": "...", "assignments": [], "reviews": [], "catalog_version": "...", "rules_version": "..." } }
```
`POST /api/v1/field/uploads/` → presigned S3 URL bound to an event id.

Initial event types: shift.open, shift.close, location.ping, supplies.receive, supplies.reconcile, ovitrap.place, ovitrap.check, ovitrap.replace, ovitrap.relocate, ovitrap.remove, release.record, sample.collect, fuel.load, incident.report, emergency.accident, community.activity, record.void.
`ovitrap.check` payload: `finding`, `paddle_present: bool`, `has_eggs: bool|null` (null if no paddle), `temperature_c`, `humidity_pct`, `bag_code`, `paddle_type`, `is_lagged`. Feeds `paddle_present` and `has_eggs` in `/bags/receive/` (W34).

## 6. Behavior
- Same event id twice → same result, no duplicate.
- Processed in device_time order per device.
- Clock skew over `clock_skew_review_seconds` → `in_review`, never rejected for that alone.
- Results carry `code` + `params`; the phone renders the plain-language message from `packages/i18n` (P28). No user-facing text in the API.
- `location.ping` only while a shift is open; feeds the live view.

## 7. Edge cases & errors
- Unknown type/schema → rejected with `code`, raw payload kept.
- Void of another user's/org's event → rejected.
- Partially invalid batch → valid events accepted.
- Payload over limit → 413; rate limit per device.

## 8. Acceptance criteria
- [ ] Idempotency, clock-skew and org-isolation tests.
- [ ] Validator registry documented in `docs/sync.md`.
- [ ] Rejections create ReviewItems visible to SUP.

## Notes
[PENDING] Location ping frequency and retention (privacy: only during open shift). [PENDING] Recount trigger rule (W36) belongs to the lab epic.
