TITLE: [Backend] Per-device quota and alerting for rejected field events
LABELS: backend,security

## 1. Context
#5 stores every rejected field event (with a marker instead of oversized/unstorable payloads) and opens a `ReviewItem` for each. Rows are insert-only. A compromised or buggy phone can still create many rejected events and review items within the throttle (60 batches/min × 200 events), flooding the supervisor's review queue and the database.

## 2. Goal
Bound the number of stored rejections per device and alert operators when a device misbehaves, without losing idempotency or the audit trail.

## 3. Scope / Out of scope
**In:** a per-device daily quota of stored rejected events (configurable), a batch-level answer once the quota is exceeded, an operator alert/log, aggregation of repeated identical rejections in the review queue (optional).
**Out:** review decisions (#22), notifications (#49).

## 4. Data model
Proposed: counter per (device, local day) in cache or a small table; no change to `FieldEvent`.

## 5. Contract (API / interfaces)
Proposed: `429 rejection_quota_exceeded` with `Retry-After` until the next local day; setting `SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY` [PENDING value].

## 6. Behavior
Accepted and in-review events are never blocked by the quota; only storage of further rejections is.

## 7. Edge cases & errors
- Idempotent retries of an already stored rejection do not count twice.
- Quota resets at the organization's local midnight.

## 8. Acceptance criteria
- [ ] Quota enforced and configurable, with tests.
- [ ] Operator alert/log when a device hits the quota.
- [ ] Documented in `docs/sync.md`.

## Notes
Follow-up from the #5 security review (2026-11-03). Depends on #5.

