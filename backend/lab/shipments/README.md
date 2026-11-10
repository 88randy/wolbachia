# UIEB shipment sources and external material delivery (#118 / B22)

Shipments freeze actual B18 Bag/Reading, canonical B21 WolbachiaSample and B08 LotVersion references at an aware
cutoff, including original source clocks, payload hash, rules/catalog pins and
review effect proof. `source-projection-v1` names this technical projection; it
does not claim an authoritative Annex VI legal edition. B25 owns rendering and
download. No image pixels, biological procedure or legal form field is inferred.

`POST /uieb-shipments/` accepts `source_ids`, `cutoff`, optional
`recipient_institution`, optional `supersedes_id` and a required normalized correction `reason` when
superseding. A new linked shipment retains the original snapshot and hash. Source
void or a later lot version makes the old projection `is_superseded`; neither
operation rewrites the original. The read response always rechecks B24 transfer
eligibility. RFC remains blank with `rfc_transfer_not_authorized` or
`rfc_source_unavailable`: protected RFC storage belongs to the parallel #100.
An omitted recipient has no transfer eligibility. Neither snapshots nor grant records store an RFC value. Responses are private,
and disclosure surfaces must repeat the current B24 selector.

`GET/POST /material-requests/` uses a real `lot_id`, `location_id`, optional
`piece_id`, positive `quantity` and `recipient_institution`. The actual unit version
is selected from genuine positive custody movements, retaining their original
unit pin even after metadata changes. Optional `unit_version_id` disambiguates
multiple available pins. Current physical location determines request authority;
historical admission at another center grants no extra requirement.
`POST /{id}/cenaprece-notification/` records `reference`,
`date` and nonempty `evidence_ids` as actual owned/device-matching verified private
uploads. This is a recorded notification receipt, not a claim that the server
sent a message. `POST /{id}/deliver/` requires `command_id`,
`signature_upload_id`, `expected_revision`. Each notification evidence fact adds
one revision; a delivery or void adds one. Unknown/foreign references are opaque.

The existing User -> Device -> Session -> Pair -> Organization inventory arbiter
serializes notification, CAS, current stock safety/reservations, receipt, private
binding and one negative StockMovement. Competing transactions return retryable
429 through the existing mapper; no storage/network/mail occurs under these
locks. Exact authorized delivery replay returns the same receipt before mutable
state checks; changed command content conflicts. Delivered requests cannot be
voided without genuine compensation, so this slice safely returns409 instead.
An open request or shipment can append `/void/ {reason}` using the common normalized
10-visible/1000-stored limits. There is no DELETE or new FieldEvent family.

All lists use page numbers, exact scoped `?code=`, center/quadrant filters, explicit
created_at/code ordering and `include_voided`. A single paired grant must cover
every source or the actual material custody context before count or paging.
Permissions are `shipment.read/create/void`, `material_request.read/create/notify/
deliver/void`; evidence independently needs `field.upload`, stock safety needs
`lot.read`. No role grants or operational defaults are seeded.

Dependency audit: B10 reservations/ledger and B18 provenance already exist. B24's
minimal authorization/revocation owner is `privacy/`; full ARCO/retention remains
#120. The canonical B21 sample owner is `lab/samples`: its real `sample.collect`
handler retains exactly one `{kind: reading|lot|release, id: UUID}` source. Shipments
consume that existing identity, including archived origin, GPS, method, collector,
source proof and clocks; no second sample writer or reception location is inferred.
Sample and upstream source corrections flag existing snapshots without rewriting
them. Unknown or unapplied source UUIDs fail closed.
No #116
permit/release or #100 protected identity model is duplicated.

`tests/test_lab_shipments_b_22.py` owns notification/signature gates, exact replay,
one debit under contention, frozen revisions, real Bag provenance and the single
HTTP scope wiring. `tests/test_shipment_privacy_118.py` owns current transfer
eligibility/revocation. SQL guards retain authored same-tenant facts, exact
snapshot sources and actual verified evidence/stock dependencies. Populated
downgrades refuse to erase history. PostgreSQL execution is required to qualify
these guards and races; static checks alone do not establish that result.
