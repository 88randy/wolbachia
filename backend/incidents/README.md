# Scoped incidents (B-06)

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

Official API references: Django 5.2
https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update and
https://docs.djangoproject.com/en/5.2/topics/db/transactions/#performing-actions-after-commit;
drf-spectacular's polymorphic schema helper source:
https://github.com/tfranzel/drf-spectacular/blob/master/drf_spectacular/utils.py.
