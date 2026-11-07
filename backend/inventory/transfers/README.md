# Signed custody (B-09 / #106)

Read ../README.md, ../../README.md and docs/engineering-rules.md first. This is
one extension of inventory's ledger and canonical113 review/history, not another
balance, source inbox or history producer. No courier assignment/B10, client
screen, release protocol or biological defaults are added.

## Facts and commands

Transfer and TransferLine retain the expected real origin/destination, lot,
optional Piece, exact unit and LocationVersions. Preparing writes no reservation,
debit or credit. Dispatch appends its signed manifest and exact negative origin
legs. Actual receipt appends independently verified signature, bounded actual
credits, duplicate feedback and durable discrepancies. Transit is the derived
unreceived dispatch, never a spendable Location. A piece cannot be counted twice.
Quantity is exact finite positive Decimal(20,6); it never passes through float.
The 1000-item JSON bound is technical, not a biological or stock threshold.

services.py accepts immutable commands.py values; transitions.py is the one
retained writer for HTTP and real source events. Each successful transition has
an immutable TransferCommandReceipt. After fresh current authority, the exact
original command returns its original event even after later revisions, before
CAS/state/evidence reconsumption. Changed command UUID reuse is an opaque409.
Close uses its server command UUID and unique discrepancy/revision/body digest;
clients do not invent another required close command_id. No automatic replay POST.

Discrepancy reads include their own status, the real nested transfer's expected/
actual signed events and outstanding quantities, and exact owned hold/disposition
references under the complete discrepancy.read vector. They do not rely on an
additional transfer.read fetch for these case facts. Resolution responses identify
the actual discrepancy; event, operation and resolution UUIDs stay distinct.

Expected scans identify a line. An identified extra requires a real same-org
identity with existing positive destination custody; it is quarantined without
credit. An unproven literal scanner code uses unidentified_extra beneath an
already authorized Transfer, with no resource FK or foreign lookup and no credit.
Extra quarantine covers only its uncredited manifest/DiscrepancyLine quantity;
it creates no TransferHold over expected or already-accounted destination stock.
Missing retains its owned hold, and every unrelated hold remains in mandatory P.
Missing quantities are recomputed by the server and require verified per-line
photo coverage. Signature and photo IDs are disjoint, owned by the actual source
actor/device and verified by the existing uploads pipeline. No byte/file/network
work occurs under custody locks. HTTP evidence has transfer_event primary parent;
sync evidence keeps its real FieldEvent primary parent and secondary custody refs.

## Resolution, safety and correction

A complete positive quantity partition closes each discrepancy exactly once:
ack_missing has no second movement; recover_dest and return_origin need the exact
original signed dispatch/missing receipt plus NEW verified receiving signature
and photos, current receive+close authority and current safety at the credited
site. reference_signed_correction consumes a real separate accessible signed
receipt allocation and creates no second credit. Unknown extras remain uncredited
until an actual matching signed correction exists. No free-form stock adjustment.

Within ONE transaction the writer proves all outcomes/evidence, appends ONLY its
own discrepancy hold dispositions, evaluates remaining mandatory safety, then
appends bounded credits and receipt. Any unrelated hold or later constraint/effect
failure rolls all new facts back. A normal condition reading never clears a hold.
The shared P(lot,location,time) retains global expiry/type/completeness/protocol
and unresolved biological holds, plus this real location's current storage and
exact protocol/local-day two slots. Dispatch needs P(origin) and suitable actual
destination; receipt/recovery/return need P(credited site). Lot.protocol_id=null
stays absent even when nested SupplyTypeVersion has a protocol.

Voids preserve all old signatures, manifests and signed legs. A source with no
operational effects can be cancelled; a materialized source needs exact prior
supported return compensation, zero net affected legs and no unresolved dependent
discrepancy, otherwise transfer_void_blocked. ack_missing is not compensation.
Canonical reason_code/Other rules remain; every transfer void also requires the
normalized10-visible/1000-max note. No general stock-edit or void HTTP route.

## Authority and lock order

ONE contributing action binding covers BOTH endpoints and EVERY actual line pair.
Split endpoint grants never combine. Lists scope before search/count/order/page.
No role-name shortcut. Current positive B custody plus a complete B→C action grant
permits onward transfer without admission-A lot.read. Whole transfer/evidence still
requires the complete read vector; a historical B leg at0 conveys no current lot
authority and exposes no private counterpart context.

The optional custody_location query explicitly selects current positive authorized
custody for Lot metadata/safety. Default collection/detail retain legacy admission
visibility and initial safety. A custody-only detail reader must select a site:
after positive current authorization, omitted context returns409
storage_context_required. Unknown/foreign/no-positive returns404 first. The old
location facet remains historical and grants nothing. Original actor is redacted
for custody-only readers. Location has no invented is_active field.

Order: sorted current/source Users → actor Device/Session/Pair → sorted real source
FieldEvents → Organization NO KEY UPDATE NOWAIT → existing courier TRY locks →
sorted Location/SupplyType/Lot/Piece → Transfer/Discrepancy → sorted Upload. Recheck
current scopes/relations under Org. No late account/source/courier lock or I/O.
Use the existing retained inventory marker across operational rollback/deferred
checks. Busy requests use bounded429/Retry-After1; no sleeps or timeout inflation.

## Sources, review and SQL

transfer.dispatch/transfer.receive schema1 have checks_shift=False only for these
custody families. Global auth, clock and final-upload gates remain. NEW in_review
sources retain original payload/status/clocks/catalog/rules/capture facts and
evidence with ZERO operational events/stock/holds/success receipt. Source authority
is historical proof; reviewer action+decide and current safety remain independent.
Only canonical113 creates the effect receipt and accepts once.

A declared dispatch dependency is transfer_source: exact same-transfer real
dispatch FieldEvent/link/hash/effective receipt and captured typed child subject.
Its narrow SQL branch permits different sender/receiver authors without weakening
old parent types. No fabricated parent FK. Handler application precedes FieldEvent
storage, so TransferEvent retains declared UUID/hash and an append-only source link
is completed after the real source/receipt exists. The same typed history producer
advances to schema3 with transfer_custody, event UUID id plus transfer_id. Only
the authentic already-prelocked source author owns its durable history; HTTP
invents none. Persistence retains a truthful void upsert during download revocation.
Current complete-vector FIELD_BOOTSTRAP gating before changes/bootstrap/LIMIT
prevents reading until regrant. No recipient is discovered or locked late. A publication
receipt is internal persistence, never proof of delivery.

New migrations add tables/columns without rewriting old facts. Every custody row
has insert-only provenance/tenant guards; deferred completion verifies exact
manifests, evidence, replay/source receipts, expected/actual stock legs and bounded
resolution partition. Failed downgrade refuses retained new facts before dropping
guards. Old admissions, signed readings/hashes and all four upload parents survive.

## Verification ownership

test_transfer_policy_106.py owns pure binding/Decimal/scan/partition rules.
test_inventory_transfers_106.py owns actual custody, evidence/replay, four resolution
outcomes, rollback, one HTTP boundary and canonical source/review/history journeys.
test_transfer_locks_106.py owns observable separate-connection affordable dispatch
and fresh authority barriers. test_transfer_migrations_106.py owns legacy upgrade,
raw invariants and protected reverse. Existing seed/registry/history contract tests
retain their owning seams. Collection/offline model checks are not PG execution.
Real PostgreSQL CI remains required. No new dependency is introduced.

References: [Django transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/),
[row locking](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update),
[conditional constraints](https://docs.djangoproject.com/en/5.2/ref/models/constraints/).
