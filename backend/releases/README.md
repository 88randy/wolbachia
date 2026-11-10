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
`permit.manage` and `field.upload`, the actor's own verified unbound image and an
explicit official-document review attestation. The existing upload verifier accepts
JPEG/PNG only; this is a reviewed image of the official document, not verification
of an arbitrary PDF or a digital signature. The version pins the immutable byte
verification and its real reviewer; it grants no evidence download or reparenting
capability. Courier polygons and risk colors never provide permit authority.

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

Permits producer1 is typed in bootstrap and changes. Suspension publishes scoped
CourierChanges and immutable recipient notices; `delivery_unavailable` explicitly
does not claim external notification delivery. Assignment producer4 admits only
explicitly planned release work; root2, history7 and supplies1 are preserved.
