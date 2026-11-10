# Transfer eligibility for UIEB shipment projections (#118)

This is the minimal B-24 owner needed by shipment source reads. It adds no RFC
value storage, public API, ARCO policy, retention process or legal calendar. The
full privacy workspace remains #120. Protected RFC storage belongs to #100;
an authorization does not create a personal value or prove legal compliance.

`create_transfer_authorization(actor, TransferAuthorizationInput)` records an
explicit recipient, the fixed `uieb_shipment` purpose and `rfc` field, a real
Center/optional exact Quadrant, a caller-supplied validity interval and reference.
`revoke_transfer_authorization(actor, id, reason)` appends a permanent withdrawal
with the shared normalized 10-visible/1000-stored reason limits. Both require
`transfer_authorization.manage` at that exact pair and use the existing identity
then Organization transaction arbiter. No permission, duration or grant is seeded.

`can_transfer_rfc(actor, recipient_institution, contexts)` rechecks current
`shipment.rfc_transfer` authority with one paired binding over the complete real
vector, then an active non-revoked exact recipient/purpose/field authorization for
every actual context. A null quadrant is an exact context, never a wildcard.
Absent, expired, future, revoked or out-of-scope facts deny. B-25 export/download
must invoke this selector again at the time of disclosure and still require a
real protected RFC source; storing a prior eligibility result is insufficient.

Immutable tenant/parent SQL guards protect both facts. The new app has no effect
on existing sync event registration, original ingest status or source clocks.
`tests/test_shipment_privacy_118.py` owns absence/revocation, recipient/time/vector
eligibility, permission loss and management relation/reason validation. Database
tests and SQL guards require PostgreSQL; collection alone does not qualify them.
