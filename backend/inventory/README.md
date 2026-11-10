# Inventory (B-08 / #105)

Read backend/README.md, engineering-rules.md and API conventions first. All
masters, versions, conditions and stock facts are organization-scoped and
insert-only. Stock is the sum of signed movements, never an editable balance.

An authored admission produces the sole opening credit. Drafts with missing
metadata or biological protocol create no stock effects. Once admitted, quantity,
identity and location cannot be edited. #106 adds signed facility custody and
bounded compensation through the SAME ledger and current safety evaluator; #107
courier custody remains separate. See transfers/README.md.

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

## Inventory read contracts (#270)

`GET /locations/{id}/movements/` returns actual individual signed ledger legs,
not the stock aggregation or a reconstructed operation. Parent and legs require
current location.read; each real lot also requires current lot.read. Filters are
lot/supply/operation UUID, piece=UUID|none, exact unit, created_at_from (inclusive)
and created_at_before (exclusive). Reference eligibility precedes filtering,
count and paging. An operation selects only its visible legs. Order by
created_at|lot_code|quantity (optional minus), default -created_at, with id tie.
Rows retain operation/line/lot/supply/location/piece ids and codes, signed Decimal
quantity, exact unit/unit_version_id, actual lot_admission source UUID and actual
created_at/nullable created_by User reference. No generic source-detail route is
implied. #106/#107 still own future source kinds and custody writers.

Three paginated form choices require the actual creating/updating action:

- `/locations/owner-options/`: create requires center and quadrant=UUID|none;
  update requires only location. Resolve and authorize the real immutable pair
  and active Center first. Results contain membership_id and display label only.
  Search/order use that label (label|-label, membership UUID tie); full name falls
  back to username and duplicate eligible labels include username.
- `/locations/placement-options/`: action=location.create plus center returns
  permitted real Quadrants and explicit center_only. action=lot.create plus center
  returns permitted real Locations and center_only_draft. A lot create sends
  initial_location_id (quadrant derived by the writer), or only center_id for a
  center-only draft; LotWrite never accepts quadrant_id. Update accepts only lot,
  derives immutable placement and revalidates its active Center. Before admission,
  choices match that actual pair, with clear allowed only for a center-only Lot.
  After admission, only the exact retained Location reference is returned readonly.
  Search uses actual code; stable kind/code/id ordering precedes paging. The
  discriminator distinguishes quadrant/center_only/location/center_only_draft;
  only lot choices include location_id and is_read_only.
- `/supply-types/protocol-incident-type-options/`: no supply requires
  supply_type.create; supply=UUID requires supply_type.update on that org master.
  Active latest_types return only incident_type_version_id, code and label,
  searched by code/label and ordered code/id. The returned version UUID, not the
  CatalogItem UUID, is ProtocolWrite.incident_type_id. Empty configuration remains
  empty; no new terminal eligibility policy or broad incident.read grant is added.

Owner eligibility discovers only DISTINCT raw Membership/Profile scope columns
(ordering cleared), then reuses safe_scope and contains for the whole shape,
including an inapplicable axis. JSON null/malformed/none never inherit. The final
lazy SQL query rechecks current tenant/activity and exact raw membership scope,
Exists of the SAME assigned active same-org location.read Profile with eligible
raw scope, and NOT Exists any active assigned same-org government Profile.
Labels/count/page follow that predicate; no Member/User roster or per-member
effective_scope evaluation is loaded. Revocations are visible on final evaluation;
new undiscovered raw scopes can be omitted until refresh. Writers still revalidate.
Cost is O(D) distinct scopes and parameters, worst case D approaches N; no silent
cap/truncation or broader fallback exists. Material parameter/cardinality limits
need a measured follow-up, not a new parallel JSON/UUID authorization grammar.

Lot reads include exact supply_version (including its retained protocol),
admission_id or null, and exact location_version_id projection
{id,location_id,code,name} or null. These are authorized by lot.read and do not
require current location.read or expose current geometry/owner/safety/stock.
Protocol.incident_type retains the exact version's minimal id/code/label.
Location.owner_label exposes the already authorized owner's current display name.

Lot blocked_by facets match evaluate_lot's current blockers, including drafts:
supply_type_inactive, lot_expired, protocol_not_configured,
storage_safety_not_configured, insecticide_free_required, condition_slot_missing,
condition_breach. expiry_from_date/expiry_before_date are organization-local day
starts, inclusive/exclusive; same-bound date+instant mixtures and inverted ranges
are 400. Existing instant facets and status stay available; no implicit threshold.

Unknown/foreign/out-of-scope references share 404; missing action is 403; invalid
query shape/range is coded 400 validation_error. Empty options is 200 empty page.
Those #270 read endpoints introduced no read locks, writes, grants, defaults,
migrations or policy changes.
The grouped test_inventory_read_contract.py cases cover PG parity, late revocation,
pagination, real admissions/provenance, exact pins, blocker/date SQL and one HTTP
boundary. Local pure/ORM-compilation checks do not establish PostgreSQL execution;
real focused PostgreSQL and full backend CI/coverage remain required before closure.
Read primitives: [Exists](https://docs.djangoproject.com/en/5.2/ref/models/expressions/#exists-subqueries),
[DISTINCT](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#distinct),
[UNION](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#union).

## Signed facility custody (#106)

transfers/ adds real transfer/discrepancy routes, signed expected/actual manifests,
immutable command receipts, one-ledger dispatch/actual receipt and bounded recovery
or return. No editable balance or transit Location is created. Current positive
custody and ONE binding over both endpoints/all line contexts control onward work.
History at a location remains a scoped signed leg even after balance0; it does not
grant current lot metadata or the private counterpart's whole transfer.

Lot GET list/detail adds explicit custody_location=UUID. Default remains legacy
admission scope/initial safety; selected context requires real positive custody
and lot.read at that site. A custody-only detail without context returns a safe409
only after authorization. Original actor is redacted; storage_context_required is
not an existence probe. Movement source_transfer is minimal and null unless the
reader has complete current transfer.read, regardless of a historic location facet.

Conditions add a strict explicit-location branch. New rows retain capture_mode,
capture_location_id and exact LocationVersion; legacy omitted-location captures
remain a named compatibility adapter. A and B may be measured at the same instant;
an exact legacy reading can certify ONLY its original proven location. A measurement
at B needs its own condition.create scope but no stock and grants no custody.
P(lot,site,time) keeps global biological holds and uses only that site's slots and
current storage. Null Lot.protocol never inherits nested supply configuration.

See transfers/README.md for closed outcome wire choices, source/review/history
integration, primary evidence, global locks, new SQL and criterion/test ownership.

## Exact movement lot codes (#292)

Only `GET /locations/{id}/movements/` accepts optional `lot_code`. It filters
the existing signed ledger by exact human code, including when current stock at
that location is zero. It does not resolve current lot metadata or admission scope.
Validation delegates to the public CodeQuerySerializer: surrounding whitespace
trimmed, at most 50 characters, nonblank and no NUL. Errors use the normal 400
envelope under `fields.lot_code`. A UUID-looking code remains a code; repeated
parameters use the last value. No substring, case folding, wildcard or comma-list
interpretation is added.

The real parent location is authorized first. Like the existing lot UUID facet,
the code reference must have a leg in current tenant/paired-scope `scoped_legs`;
unknown, foreign and wholly inaccessible codes share safe 404. Then all filters
intersect on the requested location's already permitted rows before count, stable
ordering and paging. Readable references in another permitted location can return
an empty page here; contradictory readable `lot`/`lot_code` filters also return an
empty page. Existing UUID/operation/piece/unit/time/default-order behavior remains.
No stock, lot list/detail, condition or PATCH action gains this parameter.

Historical rows retain their actual movement/operation/source/event identities,
signed decimal quantities, unit pins and existing transfer metadata redaction.
Zero stock does not erase history or grant current custody/whole-transfer access.
Owning tests extend existing read-contract and B-to-C custody groups; generic code
grammar stays owned by tests/test_code_filter.py. SQL execution requires PostgreSQL.

## Courier supplies (#107)

allocations/ owns complete courier custody, reconciliation and biological disposal
through this app's SAME signed ledger. Location and SupplyAssignment custodians
are mutually exclusive, never dummy storage. Plan0effects; release reserves;
signed actual receipt moves stock once; use/loss and signed warehouse return debit
real custody. The canonical transfer require_available also subtracts current B10
reservations; balance still means signed physical legs. See allocations/README.md
and docs/api-conventions.md for paired whole-vector actions, source proof, concrete
HTTP evidence parent, disposal/Lab data-only correction and exact replay.
Location read filters/order/balances remain unchanged. Only necessary real-source
select_related paths and one private supply_request context support additive
nullable source_supply metadata. Legacy source_transfer behavior is retained.

## Physical paddle recovery (#115)

PaddleStockReturn is the concrete typed recovery source in this same ledger.
The consumed branch retains the authentic SupplyUse debit/receipt and credits
exactly one same Piece/lot/unit at the authorized destination, once per debit and
physical reuse cycle. It does not reverse consumption or release reservations.
The positive-custody branch requires the actual canonical return_accept credit;
treatment creates no second operation. Missing physical/QA/draw/method/evidence
proof is unavailable, never implied by a field flag or an absent obligation.
Movement GET exposes source_kind=paddle_return and that real stock-return UUID;
the original nullable source_supply/source_transfer fields and all location/lot
read filters, balances, scope and paging remain unchanged.

## External material delivery (#118)

The real Lab DeliveryReceipt is a typed, one-to-one source in StockOperation.
`append_material_delivery_stock` appends exactly one negative movement at the
request's real location, with its exact lot, optional piece and unit version.
It requires the existing inventory arbiter, current material_request.deliver and
lot.read authority at that location, current site safety and spendable stock after
B10 reservations. The delivery owner retains notification/signature/revision and
command replay gates; it commits the receipt and debit together. No external
institution is represented as a storage Location or courier assignment.

SQL requires the authentic receipt/hash/author and one exact negative movement.
The existing shared balance/reservation guard covers this source too. Every old
admission, transfer, courier and paddle-return source branch remains explicit.
Receipt replay returns its saved result without another movement. Shipment source
snapshots are descriptive provenance and do not themselves move material.
