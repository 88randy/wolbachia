# Inventory (B-08 / #105)

Read backend/README.md, engineering-rules.md and API conventions first. All
masters, versions, conditions and stock facts are organization-scoped and
insert-only. Stock is the sum of signed movements, never an editable balance.

An authored admission produces the sole opening credit. Drafts with missing
metadata or biological protocol create no stock effects. Once admitted, quantity,
identity and location cannot be edited; future transfers/compensations belong to
#106/#107 and must consume the same ledger and locked dispatch safety gate.

Biological protocols are named, explicitly supplied versions: no shelf life,
species, temperature/humidity band or reading hours are seeded. Both configured
windows of the current organization-local day are required even before the second
window. Yesterday and grace periods never fill missing readings. Range boundaries
are inclusive. Captures retain both clocks and evaluated range/timezone/window.

An out-of-range reading retains one owned hold. A normal reading never clears it.
Missing incident policy retains a pending hold; recovery links it once when a
valid named terminal/type is available. Only that incident's evidence-backed close
clears its hold. No false FieldEvent, incident.create grant to the producer, email
delivery claim or Incident -> Lot lock callback is introduced.

Writes lock current identity User -> Device -> DeviceSession -> TokenPair, then
Organization NOWAIT NO KEY UPDATE, then sorted inventory identities. Fresh paired
action/center/applicable-quadrant grants are checked under the same arbiter.
Deferred FK checks share the bounded 429 mapper. No I/O under SQL locks.
The transaction yields that locked Organization snapshot. New lot expiry and
condition date/window/timezone use its current configuration, even when the
request actor carries older settings; existing facts and actor authority remain.

The piece admission cap is a technical 10,000 identities per operation; validate
integral Decimal counts before expansion and use bounded SQL batches. It is not a
biological limit. Existing physical-trap client UUIDs and legacy supply_refs remain
untouched. Labels, assigned courier projections and debit workflows are separate.

Seed grants are once-only. Admin alone receives supply_type.deactivate by default;
warehouse receives master create/update, lot writes and conditions. Supervisor
receives reads/lot writes/conditions; entomologist reads/conditions. Custom profiles,
revoked grants and government portal-only boundary are retained.

## Scope dimensions

SupplyType/SupplyTypeVersion and their named protocol configuration are known
organization-wide masters. Their authority is the action code in the active
membership, even when both work dimensions are none. This is the approved #105
plan's explicit policy, following organizations/README.md's org-only configuration
rule and #104 configuration.write_type's action-only type management; it does not
infer a grant to a center. This differs from a storage object whose center is
unknown: every Location/Lot has a required actual center, and none/empty selected
denies that applicable axis. A null quadrant is inapplicable only for a validated
center-only storage identity. Unknown models or missing storage lookups fail closed.

require_action is only an early action precheck, never storage authorization.
All storage create placements are resolved/authorized before looking up codes, so
new/existing codes return the same undisclosed result to an unassigned caller.
Current references/scope are also checked before updates or revision conflicts.
One HTTP group covers default-none versus explicit-all for master/storage lists,
details and writes; the pure guard regression distinguishes a known org master
from a NULL-center storage object or an unsupported model.

## Contract and integration seams

`/supply-types/`, `/locations/` and `/lots/` provide GET/POST and detail GET/PATCH;
PATCH requires expected_revision and appends a snapshot. Supply deactivation uses
POST with expected_revision and retains prior versions. Public ids are immutable
master/lot UUIDs; version identifies the exact returned immutable snapshot. Codes
are organization-unique and support scoped exact `?code=`. Lists use server facets,
stable ordering/id ties and page-number paging. No DELETE/PUT or stock mutation
route is registered. Unknown operational fields are refused at the input boundary.

Supply `protocol` is explicit versioned configuration; `specification` is descriptive
text. Protocol values include shelf_life_seconds, expiry_basis=laid_on, inclusive
temperature/humidity bounds, reading_windows=[[start_minute,end_minute],...],
required_fields and incident_type_id. Empty/missing configuration is supported and
never supplies a scientific value. Windows have exactly two ordered nonoverlapping
intervals within 0..1440, start inclusive/end exclusive. A local expiry date means
the next local midnight; an instant equal to expiry is expired. Explicit expiry
cannot exceed a supplied protocol's lifetime. Protocol shelf_life_seconds is an
elapsed duration: convert the laid-on local midnight to UTC before adding seconds,
including across DST changes. Calendar expiry dates still use the next local
midnight. Original date/timezone/basis remain.

Lot revisions pin supply_version_id/protocol_id. Ordinary detail edits preserve
those pins. Explicitly adopting another supply_version_id selects that version's
protocol unless protocol_id is supplied; foreign/incompatible pins return 404.
Older readings retain their evaluated range. Existing admission quantity/location
are immutable; `quantity` on a lot is its original admission input, not current
availability. Actual availability is the signed stock ledger.

`GET /locations/{id}/stock/` returns page-number quantities by lot/piece/unit plus
real source operation UUIDs. The location.read and lot.read scopes both apply.
`GET/POST /lots/{id}/conditions/` reads or appends device_time,temperature_c,
humidity_pct. Exact natural-key replay (organization,lot,device_time) returns the
original fact; changed measurements conflict. Future capture timestamps are refused.
Missing protocol is unassessed, not normal. Readers without incident.read receive
no incident identity/pending disclosure. No new FieldEvent type/code is registered.

`inventory_transaction` provides the shared arbiter; `require_dispatchable(lot,
actor)` requires that same held arbiter and returns LotSafety or a safe conflict.
All current stock is opening custody, so this gate/projection uses initial lot
scope/location. #106 must add the real current source/destination location/action
context to these seams when it adds transfers, keeping global lot safety separate
from current storage safety. It must preserve admission/lot scope history and
reuse evaluate_lot, not move original metadata or duplicate the policy. Likewise
StockOperation currently accepts only real lot_admission sources and has a required
admission FK; #106 adds its concrete source schema/idempotency and signed legs.
There is no fictional generic debit writer in this issue.

Automatic origins are closed to persisted breached ConditionReading sources.
Recovery may use the current explicitly adopted lot incident policy, while retaining
the reading's original evaluated range/timezone. Each origin stores its exact type
and source provenance. The scheduled bounded recovery is every 60 seconds (a
technical retry cadence, not an SLA or a scientific threshold). Publication remains
#104's private after-commit producer; actual B-07 delivery is separate.

400 uses coded fields, 409 inventory_state_conflict uses safe blocked_by reasons,
429 inventory_in_progress uses Retry-After:1 and rolls back all partial effects.
The documented inventory_revision_conflict/identity/source/dependent/dispatch
reasons are blocked_by reasons, not separate invented HTTP envelope codes.

## Acceptance and verification

Pure tests in tests/test_inventory_b_08.py cover safety, inclusive named ranges,
current local slots/fold and bounded piece expansion. DB cases cover authored
admission/ledger/history, pending source/recovery, own incident clearance, pinned
range adoption, actual HTTP master/draft/query/default-deny/foreign scope and raw
SQL guards. tests/test_inventory_locks_105.py uses separate connections and event
barriers for competing admissions and condition sources, plus permission loss.
Existing seed tests protect delivered bundles and retained revocations. No repeated
DRF field/framework checks or fake transfer endpoint are acceptance evidence.

Local SQL application/concurrency and full-backend acceptance remain UNRUN until
real PostgreSQL CI. The database-free migration-state check uses Django's dummy
backend to prohibit database access; it does not prove migration application,
reverse SQL, triggers, constraints, transaction behavior or live schema consistency.
The ignored handoff records exact commands/results and contract hashes. No local
services, Docker engine workaround, host 5432, phone/native or browser run is used.

Verified primitives: [Django row locking](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update),
[transactions/on_commit](https://docs.djangoproject.com/en/5.2/topics/db/transactions/#performing-actions-after-commit),
[PostgreSQL locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS),
[Django ArrayAgg](https://docs.djangoproject.com/en/5.2/ref/contrib/postgres/aggregates/#arrayagg),
[Python zoneinfo](https://docs.python.org/3.13/library/zoneinfo.html).
