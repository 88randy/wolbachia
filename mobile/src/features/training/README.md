# P30 training and evaluation feedback (#144)

P30 reads the existing SQLite cache before any network request. The existing
DayStore bootstrap/change transaction publishes B03 `EligibilityBundle` rows;
there is no new queue, transport, cursor, migration or capture writer. An upgrade
requires a complete authenticated bootstrap before this consumer is ready. Deltas
cannot hydrate an unknown consumer, and an unreadable newer row invalidates its
previous qualification without allowing an older delta to restore it.
An unreadable tombstone makes the consumer unavailable until a full bootstrap;
it can never be interpreted as an absent policy that permits capture.

The cached owner, session and scope revision must match current accepted identity
and the existing capture context. Current paired grants filter every row. Revoked
scope removes downloaded training/evaluation data while retaining authored drafts,
outbox events and attachments. The loader hides personal information synchronously
before a queued read and rejects stale completions after invalidation. REST
publication and denial cleanup both compare the original raw source rows, so a
late reply cannot overwrite or erase a successor bootstrap after scope ABA.

The generated client reads only the current user's
`GET /users/{subject_id}/trainings/?proof=false` and
`GET /evaluations/?subject=...&include_voided=true`. Each permission is independent;
private evaluation access is never inferred from `training.read`. Cached
certifications omit issuer/evidence material; evaluation feedback retains actual
revision, predecessor, original author, observation/reason and void provenance,
but excludes raw section scores and critical responses. The first authorized
page has an explicit partial-history notice when the server supplies `next`.
Course/version UUIDs are displayed when the contract has no historical course
label; no display label or enabled action is guessed.

Qualification narrows the server's semantic receipt at exact UTC half-open
boundaries. Expiry, future validity, withdrawn certificates and an elapsed
`next_change_at` cannot grant eligibility. Missing/ambiguous action-context rows,
missing policy or receipt remain unavailable.
Evaluation scores never grant qualification or operational permission. The pure
source reader returns its original SQL guard for the existing M09 capture
writer to assert in the same local transaction. No B03 release handler or updater
capability is invented.

`training-domain.test.ts` covers exact expiry, future/revoked validity and missing
semantic proof. `training-projections.test.ts` covers scoped offline feedback,
minimization, current read denial, malformed/older deltas, source ABA, late denied
cleanup, storage failure, file-backed cold reopen and retention of the original
pending UUID. `training-loader.test.ts` controls a deferred read to prove immediate
concealment and stale-completion rejection.
`training-remote.test.ts` checks generated self-only/proof-free reads and rejects a
response after session replacement. `training-ui.test.ts` renders the actual cards
with es-MX/en, light/dark and 130% host props to retain expiry labels, icons,
certificate identity and evaluation/void feedback without truncation.
These are ordinary SQLite/Node checks. Native encrypted storage, force-stop,
TalkBack, both physical device profiles and
real-API delivery remain unrun. No phone installation is part of this change.
