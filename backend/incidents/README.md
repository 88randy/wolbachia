# Scoped incidents (B-06)

## Reported workspace reads (#304)

`GET /incidents/?kind=reported` adds `assigned_to_me`, `overdue`, `escalated`
(strict lowercase true/false), `type` (stable CatalogItem UUID) and `origin`.
The actual current Membership, not User UUID, defines assigned_to_me. Overdue
means open with a nonnull deadline <= this query's server time; escalated means
open stage > 0 even after a comment and at terminal/null deadline. False is each
predicate's complement. Existing facets intersect, including exact pinned type_id.
Counts and page_size=1 use that same scoped queryset, with no separate summary or
atomic cross-request counter promise. Reported collection-only ordering permits
code/created_at/deadline/severity and optional minus/comma terms, always critical
first and id-stable; default deadline asc/null last, created_at,id. Fleet retains
its original representation, permission, filtering and ordering, including296.

One correlated persisted-proof annotation supplies origin to projection, filter
and count before paging: field_event, direct_report, review_decision,
inventory_condition, lab_reception or unknown. Independent unsupported or
conflicting proof defeats a tempting known cause; a later adopted IncidentOrigin
marker is provenance rather than a new creation cause. Review uses its exact
decision/item/case/author/subjects; inventory uses the retained breached reading
placement; Lab uses its real discrepancy/link/pinned policy/type and system event.
No current policy hash, browser channel, generic transfer or Lab count/rejection
producer is inferred. GET cannot create, recover, resolve or publish a case.

Reported reads add current stage/owner display, archived type_snapshot, origin,
linked_record, owned blockers, evidence and action_permissions/action_prerequisites.
Human labels are minimal real names/username or null. Related identity/code/void
metadata is explicitly unavailable when the real current parent read vector is
not authorized. Existing case/timeline evidence UUIDs remain audit facts; current
byte metadata/readability follows the actual immutable AttachmentLink via the
existing six-parent authorize_download policy, without blob/storage/network I/O.
No keys, leases or permanent download capability are exposed. Lab rejection
egg_count.read OR egg_count.void remains separate from queue/upload/close admission.
New private fields deny/redact without current exact-pair incident.read, including
create-only responses; no new permission is required to perform an existing write.

Action booleans use each existing command's current whole paired scope. Separate
prerequisites describe open state, void dependents, protected severity, pinned
close minimum and field.upload; they do not certify selected/unbound evidence or
replace transactional CAS/bind_evidence. Type deactivation does not prevent an
otherwise authorized close against its archived policy.

`GET /incidents/context-options/?action=read|create` returns paged named real
center/quadrant pairs (including center-only) within that action's paired scope.
Optional center UUID, search, page and page_size never confer center.read.
`GET /incidents/{id}/owner-options/` requires current case read and exact-pair
incident.reassign; it returns Membership id + minimal label, never a global roster.
Read and close may come from separate valid profiles, each with the whole pair;
terminal candidates additionally retain the writer's administrative codes. Raw
distinct scopes are validated with safe_scope; actual final active relationships
and government clamp are applied before count/search/page, not after LIMIT.
Options are current hints and every command revalidates. New raw scopes during
discovery may be safely absent until refresh; revoked scopes cannot qualify.

`GET /incident-types/?reportable=true` narrows latest family versions to both
active version and active parent item. False/omission preserves existing visibility;
is_active remains the immutable version flag. An older submitted active pin remains
valid under the existing full capture_version predicate; it need not be latest.

This is the W6/W7 read prerequisite only. W4/full33/30/123/176 acceptance, jobs,
writers, defaults, permissions, models and the history4/root2 contract are unchanged.

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

## Laboratory reception sources (#114)

`lab_sources.py` consumes a persisted, already authorized reception discrepancy
under Lab's retained Organization arbiter. The exact CAS-configured incident type
must have a current real owner chain, zero report photos and no invented blockers.
An unavailable type leaves the original discrepancy explicitly configuration
pending; bounded recovery creates its system origin and incident once. It creates
no surrogate Bag, Reading, FieldEvent, upload or human report. The original source
collector and discrepancy author are prepared before Organization, even when they
are different people. This adapter preserves the existing incident publication,
scope, evidence, escalation and independent resolution owners.
