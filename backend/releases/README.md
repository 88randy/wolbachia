# Permits and releases (#116 / B-20)

`PermitType` stores an immutable requirements snapshot with an explicitly configured,
positive `max_gps_accuracy_m`; there is no scientific default. Canonical People
training requirements remain independent. Types are organization-wide configuration
and creation requires an explicit whole-organization `permit.manage` grant.

[ASSUMPTION] Once-only defaults grant management/suspension/read to Admin and
Regulatory, and read to Supervisor and Coordinator. Existing revoked grants and
custom profiles remain owned by organization configuration; the seed never
restores a revoked code. Current paired scope still applies to each operation.

`Permit` fixes one actual center/quadrant pair. `PermitVersion` preserves the official
number, issuing authority, reviewed document, reviewed geometry and aware
`[valid_from, valid_to)` interval. Creating a version requires current paired
`permit.manage` and `field.upload`, the actor's own verified unbound upload and an
explicit official-document review attestation. The upload verifier accepts JPEG, PNG and PDF; this is a reviewed copy of the official
document, not verification of a digital signature. The version pins the immutable byte
verification and its real reviewer; it grants no reparenting capability.
`GET /permits/{id}/versions/{revision}/document/` downloads those exact bytes under
`permit.manage` and the paired scope (`Content-Disposition: attachment`, `nosniff`,
`private, no-store`); another organization or an unknown revision is a coded 404.
Courier polygons and risk colors never provide permit authority.

`POST /permit-types/`, `POST /permits/` and `POST /permits/{id}/versions/` append
facts. Versions take `expected_revision`. `POST /permits/{id}/suspend/` takes
`expected_revision` and a normalized reason of at least ten visible characters and
at most 1000 stored characters. Suspension is permanent for that permit identity;
renewal requires a separately reviewed permit and never clears retained history.
All writes preserve account locks before Organization, prepared courier locks,
Permit and Upload. Suspension and release validation share the same Permit arbiter;
contention is retryable `429 sync_in_progress`. Producers run without network or
file I/O inside that transaction.

`POST /release-devices/` requires `permit.manage` on the actual pair and pins a
biological source lot's immutable current version. Equipment cannot change its
source lot. Initial status is `active`; `POST /release-devices/{id}/status/`
appends `active`, `inactive` or terminal `retired` with a reason and
`expected_revision`. Reads expose the latest status without changing the source
lineage. Active equipment alone does not authorize a release.
`GET /release-devices/` and `/releases/` require `release.read`; permit
reads require `permit.manage`. Scope is applied before filters, counts and paging.
Lists use page-number paging, strict ordering, `center`/`quadrant` filters and exact
`?code=` for coded resources. Foreign or unauthorized objects are opaque 404.

`Release` retains the unique source event identity, authoritative permit/requirements,
source lot/device, training and schedule pins, positive physical quantity, GPS,
both clocks and the safety assessment provenance. Original sync results are never
rewritten. No DELETE or PATCH exists; retained rows and SQL guards are append-only.
Relation IDs use UUID strings; semantic UUID proof accepts supported text spellings
without changing the original payload or its hash. Numeric UUID inputs are refused.

`POST /permits/{id}/schedule/` explicitly creates a real planner task with a point,
courier and due date. Both `schedule.manage` and `permit.manage` must cover the
actual permit pair. The immutable `ReleaseSchedule` binds that task to its official
permit version. Capture-time task, binding, owner, equipment lifecycle and training
facts must already exist; later backdated configuration cannot manufacture them.
The planned courier must currently hold both paired sync and bootstrap authority.
Later loss of bootstrap suppresses completion deltas without changing physical
release facts or granting permission to see the task.

`release.record` schema1 requires GPS, a real shift, declared catalog/rule versions,
permit/device/lot/task/training identities, exact positive quantity and verified
private evidence. The handler retains the existing inventory arbiter, then Permit
before effect/debit. Capture and current official geometry, validity, qualification,
equipment state, schedule ownership and source/current lot safety are mandatory.
Their rejected codes are critical and have no supervisor override.

The supported courier transit policy is the existing `manual_evidence_review` with
photo proof. Its source-bound review retains original custody, protocol, permit,
requirements, training and schedule pins. Ingest creates no Release or debit.
Acceptance revalidates current safety, appends the actual Release and exactly one
negative movement in the existing courier assignment ledger. Receipt remaining,
reconciliation and void-dependency checks consume that same debit. Physical release
is retained; `record.void` refuses to erase its consumed custody.
An unapplied in-review declaration can be voided through the canonical reasoned
source marker; its immutable ingest status and evidence remain, with no debit.

Permits producer2 is typed in bootstrap and changes. Suspension publishes scoped
CourierChanges and immutable recipient notices; `delivery_unavailable` explicitly
does not claim external notification delivery. Assignment producer4 admits only
explicitly planned release work; root2, history7 and supplies1 are preserved.

## Own offline capture prerequisites (#139)

The existing permits section adds nullable typed `capture`: `as_of`, stable
`version`, `devices` and `tasks`. Both current `field.bootstrap` and
`field_event.sync` must cover the actual permit pair. The narrow self download
does not grant `permit.manage`, `release.read` or `lot.read`. Devices are limited
to biological source lots with genuine effective nonvoid receipts belonging to
this courier in that pair. It retains current authored equipment state/revision,
original source lot/version, the real task/PermitVersion binding and current
owned task revision; no same-quadrant inference creates a binding.

Each custody row retains receipt/source/assignment/shift/unit/piece identity,
receipt time, original/current lot versions/expiry, exact decimal available
quantity and actual transit policy/evidence requirements. Availability is the
nonnegative minimum of `receipt_remaining` and `assignment_balance`, never a plan.
`accounted_release_event_ids` lists only original source UUIDs whose actual
same-courier canonical release debit belongs to that exact receipt line. It can
discharge a local reservation without reinterpreting the immutable ingest verdict.
Original/current safety uses the same B20 transit evaluator and source-lot snapshot
builder. Custody rows retain UUID order. For the actual shift/local day ingestion
selects the first row with enough remaining AND ledger balance, then checks its
safety; an unsafe first sufficient row is not skipped for a later row.

The request-bound prepared capture cache and stable dependency digest participate
in the existing scope revision. Device/status, task/owner, lot/safety/policy and
custody changes invalidate the old cursor; the client obtains a full bootstrap
before capture resumes. This avoids a second feed or publication in unrelated
inventory writers. Regulatory changes still publish the existing base permit
delta with `capture:null`; that cannot hydrate self capture prerequisites.
`as_of` is an observation clock and is excluded from capture and bootstrap content
hashes; unchanged facts retain conditional304. Time-sensitive blockers still
change the dependency hash when their actual expiry is crossed.

No handler, ledger, event payload, scientific threshold, new grant, database
migration or transport was added. Original event/review/stock revalidation remains
mandatory. `test_release_capture_139.py` covers genuine own pins, whole-pair
isolation, stable ETags, safety recovery and single-ledger debit/completion; it
requires PostgreSQL.
