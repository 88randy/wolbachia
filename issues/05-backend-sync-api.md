TITLE: [Backend] Field sync API: idempotent event batches, server validation and review states
LABELS: backend,sync,priority:high

## 1. Context
Everything is captured offline and uploaded later. Records are immutable; corrections are void events. The server must re-validate rules (e.g. a release recorded offline with an expired permit).

## 2. Goal
One sync endpoint that ingests batches of events idempotently, applies them to domain models, and returns per-event results plus downstream changes for the phone.

## 3. Scope / Out of scope
**In:** event envelope, ingestion, idempotency, per-type validators registry, clock-skew review, pull of changes (assignments, review results), photo upload URLs.
**Out:** domain models of each feature (each epic adds its validator).

## 4. Data model
`FieldEvent` (OrgScoped, immutable): id (uuid from client), type, schema_version, payload JSON, device_id, user_id, shift_id, device_time, server_received_at, gps {lat, lng, accuracy_m}, rules_version, catalog_version, manual_capture (bool), voids_event_id (nullable), status (accepted | rejected | in_review), status_reason, status_message_es.

## 5. Contract (API / interfaces)
`POST /api/field/sync/`
```json
{ "device_id": "...", "cursor": "...", "events": [ { "id": "uuid", "type": "trap.check", "device_time": "...", "payload": {} } ] }
```
→
```json
{ "server_time": "...", "results": [ {"id": "uuid", "status": "accepted|rejected|in_review", "message_es": "..."} ],
  "changes": { "cursor": "...", "assignments": [], "reviews": [], "catalog_version": 3, "rules_version": 5 } }
```
`POST /api/field/uploads/` → presigned S3 URL for a photo linked to an event id.

## 6. Behavior
- Same event id sent twice → same result, no duplicate.
- Events processed in device_time order per device.
- |device_time − server_received_at| > rule threshold → `in_review` (never rejected for that alone).
- Rejections carry a plain-language Spanish message for the inbox (P28), e.g. "Esta liberación no se aceptó porque el permiso estaba suspendido; tu supervisor ya fue avisado."
- Rejection/critical events notify supervisor (Celery task).

## 7. Edge cases & errors
- Unknown event type / schema version → reject with `code`, keep raw payload.
- Void of an event from another user/org → reject.
- Batch partially invalid → valid events still accepted.
- Payload > limit → 413; rate limit per device.

## 8. Acceptance criteria
- [ ] Idempotency test (resend batch).
- [ ] Clock-skew test.
- [ ] Org isolation test.
- [ ] Validator registry documented in `docs/sync.md`.

## Notes
Event type list grows with each epic (shift.open, trap.place, trap.check, trap.replace, trap.relocate, trap.remove, release.record, sample.collect, fuel.load, incident.report, emergency.accident, community.activity, shift.close, supplies.receive, supplies.reconcile).
