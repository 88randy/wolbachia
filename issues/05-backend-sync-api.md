TITLE: [Backend] Field sync API: idempotent event batches, server validation and review states
LABELS: backend,sync,priority:high

## 1. Context
Field capture is offline. Records are immutable; corrections are void events. The server revalidates rules (e.g. a release recorded offline with a suspended permit). Web screens consume the resulting data: review items (W30), bag reception (W34), relocations (W31), shifts (W28–W29), reconciliations (W16), live positions (W28).

## 2. Goal
`POST /api/v1/field/sync/` ingests sync batches idempotently, applies them to domain models through a validator registry, returns per-event results and pulls downstream changes for the phone.

## 3. Scope / Out of scope
**In:** event envelope, idempotency, validator registry (`field_sync/registry.py`), the `record.void` handler, clock-skew review, `ReviewItem` creation on rejected / in_review events, `GET /review-items/` for supervisors, pull changes (`reviews`, `catalog_version`, `rules_version`), final upload from revoked sessions (#4), payload limits and per-device rate limit, `docs/sync.md`.
**Out:**
- Domain models and handlers per feature: each epic registers its own.
- `shift.open`, `shift.close`, `location.ping` → #8 (`location.ping` needs an open `Shift`; #19 depends on #8).
- Presigned photo uploads (`POST /api/v1/field/uploads/`) → the first epic with photos (#9 or #11); contract sketched in `docs/sync.md`.
- `changes.assignments` → #8/#9.
- Notifications of rejected or critical events → follow-up issue.
- Review decisions (accept / void / open incident) → #22.
- WebSocket fan-out → #19.

## 4. Data model
`FieldEvent` (OrgScoped, immutable except the void fields):
- `id` (client UUID), `type`, `schema_version`, `payload` (raw JSON, kept when rejected), `payload_sha256`
- `device` (FK `accounts.Device`), user (`created_by`), `shift_id` (UUID, no FK until #8)
- `device_time`, `server_received_at`, `clock_skew_seconds`
- gps (`gps_lat`, `gps_lng`, `gps_accuracy_m`), `rules_version`, `catalog_version`, `manual_capture`, `is_final_upload`
- `voids_event` (FK self)
- `status` (`accepted | rejected | in_review`), `status_code` (stable machine code), `status_params` (JSON for the message)

`ReviewItem` (OrgScoped, insert-only, app `reviews`): `field_event` (one-to-one), `kind` (`rejected | in_review`), `code`, `params`, `event_type`, `courier`, `device`. Created with every rejected or in_review event. Decisions are added in #22.

## 5. Contract (API / interfaces)
`POST /api/v1/field/sync/`. Bearer device token only (#4); permission `field_event.sync`.
```json
{ "device_id": "uuid", "sent_at": "2026-11-03T15:00:00Z", "cursor": "...",
  "events": [ { "id": "uuid", "type": "ovitrap.check", "schema_version": 1, "device_time": "...",
                "payload": {}, "shift_id": "uuid|null", "gps": {"lat": 0, "lng": 0, "accuracy_m": 0},
                "rules_version": "...", "catalog_version": "...", "manual_capture": false, "voids_event_id": null } ] }
```
→ `200`
```json
{ "server_time": "...",
  "results": [ {"id": "uuid", "status": "accepted|rejected|in_review", "code": "...", "params": {}} ],
  "changes": { "cursor": "...", "reviews": [ {"id": "uuid", "event_id": "uuid", "kind": "rejected|in_review", "code": "...", "params": {}, "created_at": "..."} ],
               "catalog_version": "...", "rules_version": "..." } }
```
`sent_at` is the device clock at send time. `code` is `accepted` for accepted events.

`GET /api/v1/review-items/` (cursor paging, `?kind=`, `?code=`); permission `review_item.read` (supervisor, admin).

Batch errors (error envelope):
- `400 validation_error`, `400 invalid_cursor`
- `401` (no bearer token, revoked session outside the final upload)
- `403 device_mismatch`
- `413 payload_too_large` (body bytes or event count)
- `429 throttled` (per device, `Retry-After`)

Per-event codes:
- `rejected`: `unsupported_event_type`, `unsupported_schema_version`, `invalid_payload`, `event_payload_too_large`, `event_id_conflict`, `void_target_not_found`, `void_target_not_owned`, `already_voided`
- `in_review`: `clock_skew`, `final_upload_after_revoke`

Initial event types (handlers registered by each epic): shift.open, shift.close, location.ping (#8), supplies.receive, supplies.reconcile (#8), ovitrap.place, ovitrap.check, ovitrap.replace, ovitrap.relocate, ovitrap.remove (#9), release.record, sample.collect (#10), fuel.load, incident.report, emergency.accident, community.activity (#11), record.void (#5).
`ovitrap.check` payload: `finding`, `paddle_present: bool`, `has_eggs: bool|null` (null if no paddle), `temperature_c`, `humidity_pct`, `bag_code`, `paddle_type`, `is_lagged`. Feeds `paddle_present` and `has_eggs` in `/bags/receive/` (W34).

## 6. Behavior
- Same event id twice (also concurrently) → same result, one row (primary key uniqueness).
- Batches of one device are serialized; events are processed in `(device_time, id)` order.
- Clock skew = `sent_at − server_received_at`. If `|skew|` exceeds `clock_skew_review_seconds` (value in force, via `rules.selectors.get_values_in_force`), every event of the batch is `in_review` (`clock_skew`); an event with `device_time > sent_at + threshold` is `in_review` too. Never rejected for skew alone. With no threshold configured nothing is flagged and the skew is stored.
- Precedence: `rejected` > `in_review` > `accepted`.
- A revoked session's final upload (#4) is accepted once; its events land `in_review` (`final_upload_after_revoke`) and the response carries `X-Session-Revoked: true`.
- Results carry `code` + `params`; the phone renders the plain-language message from `packages/i18n` (P28). No user-facing text in the API.

## 7. Edge cases & errors
- Unknown type/schema → rejected with `code`, raw payload kept.
- Void of another user's event → `void_target_not_owned`; of another organization's event → `void_target_not_found` (no leak).
- Event id already used by another organization or device → `event_id_conflict`, nothing stored.
- Partially invalid batch → valid events accepted; the invalid one leaves no domain effects.
- Body or event count over the limit → 413; event payload over the limit → `event_payload_too_large`; rate limit per device → 429.
- Limits are env settings: `SYNC_MAX_BODY_BYTES` (1 MB), `SYNC_MAX_EVENTS` (200), `SYNC_MAX_EVENT_PAYLOAD_BYTES` (16 KB), `THROTTLE_FIELD_SYNC_RATE` (60/min).

## 8. Acceptance criteria
- [ ] Idempotency (incl. concurrent duplicates), clock-skew (`sent_at`) and org-isolation tests.
- [ ] Validator registry documented in `docs/sync.md`, with the uploads contract sketch.
- [ ] Rejections and in_review events create ReviewItems visible to SUP via `GET /review-items/`.
- [ ] Final upload events land `in_review`.
- [ ] `docs/` updated and `packages/api-client` regenerated.

## Notes
- Implementation starts after #3 and #4 merge. Plan: see the plan comment on this issue.
- [PENDING client] `clock_skew_review_seconds` value.
- [PENDING] Location ping frequency and retention → #8.
- [PENDING] Recount trigger rule (W36) belongs to the lab epic.
- [PENDING] Notification channel for rejections → #49.
