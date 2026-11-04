TITLE: [Backend] Retention policy for TokenPair rows of ended sessions
LABELS: backend,security

## 1. Context
#4 stores every issued access/refresh pair as a `TokenPair` row (hashes only) to detect refresh reuse across a session's history. Nothing is ever deleted (repo rule), so the table grows with every refresh of every device.

## 2. Goal
Bound the growth of `TokenPair` without losing reuse detection for live sessions or the audit trail required by the program.

## 3. Scope / Out of scope
**In:** a retention policy for token pairs of ended sessions (revoked or expired beyond the refresh lifetime), executed by a scheduled Celery task, documented and configurable.
**Out:** retention of business records (W61 retention screen), access log model (W60).

## 4. Data model
Proposed: no new tables; optionally an archive/aggregate per session. [PENDING] whether token pairs count as business records under the "nothing is deleted" rule (they are security metadata, not field data).

## 5. Contract (API / interfaces)
No API. Settings: `AUTH_TOKEN_PAIR_RETENTION_DAYS` [PENDING client/legal].

## 6. Behavior
Pairs of sessions ended more than N days ago are pruned (or compacted to the last pair) by a nightly task; live sessions keep their full family.

## 7. Edge cases & errors
- A session revoked with a pending final upload is not pruned before its deadline.
- Pruning never touches pairs of active sessions.

## 8. Acceptance criteria
- [ ] Decision recorded on whether pruning token pairs is allowed under the "nothing is deleted" rule.
- [ ] Nightly task with tests; configurable retention; documented.

## Notes
Follow-up from #4 review (2026-11-03). Depends on #4.

