# Scoped incidents (B-06)

## Review integration (#113)

Review follow-up creates a CURRENT reviewer Incident at server_now/source_event=None
plus ReviewIncidentLink BEFORE evidence bind. Current incident.create AND
review_item.decide must cover the exact current source context/actual type/chain.
The persisted internal review_decision is freshly checked for tenant/actor/item/
kind/full context/type/description/evidence. Original source OneToOne stays free
for later valid source acceptance. Exact case/item/source verified evidence still
requires REAL parent authorize_download: case read never replaces revoked parent
read, with no reparent/durable grant. Source FE void intentionally keeps its case/
timeline/owned holds per #104. Pending severe open_incident remains nonterminal and
retains its safety hold. #105 AutomaticIncidentOrigin remains separate/unchanged.

Incidents retain immutable type versions and a numbered, append-only timeline.
`type_id` on capture is an **IncidentTypeVersion UUID**, not a catalog item UUID.
The type management URL identifies the stable `incident-type` CatalogItem. Other
remains a protected catalog item and requires an explanation.

`GET /incidents/` and `?kind=fleet` retain the existing fleet list contract.
`?kind=reported` selects reported incidents explicitly; permissions never select
the representation. New writes and detail/actions address reported incidents.

SLAs and named owners are explicit organization configuration. No screen example
defines a duty roster or duration. Missing configuration/scope sends a source to
review without creating an operational Incident. Review acceptance belongs to #113.

Owners advance supervisor → coordinator → active administrative terminal, skipping
ineligible intermediates. The terminal remains accountable. Reminders use a rolling
hour, including calendar boundaries and clock rollback; catch-up emits one notice.

Lock order: account identity before Organization NO KEY UPDATE, then Incident NO
KEY UPDATE and sorted Upload NO KEY UPDATE. Source arbitration takes FieldEvent
before Organization. Deferred FK checks stay inside the bounded retry mapper.
No account/source locks, storage, mail or broker calls occur under domain locks.

Verified #102 uploads are retained facts; each consume/download checks current
parent scope. Closing resolves only this incident's owned holds. Fleet clearance
and removal resolution remain their existing authoritative workflows. An explicit
IncidentOrigin can adopt a removal's opaque marker; that marker is not an Incident
UUID. No historical marker is backfilled or rewritten.

Committed causes are published after commit into deduplicated private notice
intents. A recovery scan finds unpublished causes after callback/broker loss. This
is a B-07 producer contract, not email/native delivery. Critical review notices are
audit-only references to ReviewItem, never operational incidents or owner changes;
unresolved scope remains pending, never broadcast.

New background facts explicitly use `actor_kind=system` and nullable `created_by`;
human facts require a real author. This does not change the core model behavior.

Publication scans use bounded keyset pages and enqueue continuations outside SQL
transactions, so an old unresolved cause cannot hide a later valid one behind LIMIT.
ReportedIncident exposes pending_outbox/outboxed for the latest event only. A new
type version with a new terminal allows the previous administrator to retire once
no open case still depends on that terminal; old offline pins then require review.

Publication of an IncidentEvent resolves the case's current owner and effective
terminal under Organization, including an explicitly reassigned final owner; it
never borrows a reserved type's roster. A busy cause remains pending while later
causes and keyset continuations proceed. Duplicate blocker kinds are rejected by
the shared service/request validator, rather than retained or silently normalized.

After-commit callbacks are named functions: Django 5.2's robust error logger reads
`__qualname__`, which functools.partial does not provide. A broker failure must be
logged without changing the already committed ingest result. The immutable cause
remains pending until recovery publishes its deduplicated intents; no delivery or
external I/O inside SQL transactions is implied.

Backend CI run 42209050398 recorded 1732 passes, two failures and 93.89% coverage;
that run is not green. It exposed the callback logging failure and stale literal
seed expectations. R2 corrects those paths and extends the existing PostgreSQL
commit/rollback journey with a failed broker and later recovery. Fresh real
PostgreSQL CI is still required; local diagnostic hooks are not SQL verification.

Official API references: Django 5.2
https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update and
https://docs.djangoproject.com/en/5.2/topics/db/transactions/#performing-actions-after-commit;
drf-spectacular's polymorphic schema helper source:
https://github.com/tfranzel/drf-spectacular/blob/master/drf_spectacular/utils.py.

## Biological condition sources (#105)

automatic.py is a new closed producer adapter, distinct from human IncidentCapture.
It consumes a persisted breached ConditionReading, explicit type and source scope
under inventory's already-held Organization arbiter. AutomaticIncidentOrigin pins
the reading UUID/hash, exact incident/type and explicit system actor. It neither
borrows human incident.create nor fabricates a FieldEvent source FK or uploaded
photo evidence. The configured type must permit zero report photos and explicitly
own exactly lot_dispatch, while preserving its real verified-evidence close requirement.
Unavailable type/terminal leaves inventory's durable hold pending for recovery.
Closing derives that one hold's resolution; there is no Incident -> Lot locking
callback. Existing human/source-evidence checks, fleet default list, escalation,
publication and read/download policies retain their current interfaces.

#106 explicit-location condition captures derive automatic incident center/quadrant
from the exact retained measurement LocationVersion, rather than the lot's original
admission. The original inventory.v1 source/hash and legacy adapter are preserved.
A condition at B requires its own current paired condition.create, even at0 stock;
it proves no custody. Global owned biological holds still apply at every transfer
phase, with no clearing callback from a transfer resolution to another incident.
