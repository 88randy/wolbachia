# Canonical sample source identity for shipments (#118)

This is the minimal B-21 owner consumed by UIEB shipment selection. A
`WolbachiaSample` retains its client sample UUID, organization-unique human code,
one genuine collection FieldEvent, original collector, exact sample-origin item,
LabMethodVersion, Location and exactly one real Reading or Lot. It creates no
release model while #116 owns release contracts. No scientific method, result,
negative status, prevalence input, collection or reception receipt is inferred.

`register_sample_identity(actor, SampleIdentityInput)` is an internal consume
service, not a new HTTP or sync API. It requires current `sample.receive` over the
complete actual Location/source pair vector. It uses the existing Lab sorted
Users -> actor Device/Session/Pair -> known FieldEvent -> Organization -> courier
TRY lock order. It accepts only a real same-tenant effective `sample.collect`
source with the exact sample UUID/code/origin/method/source identity and its real
collector author. An unapplied `in_review` or voided source creates no sample.
Exact retries return the retained identity; UUID/code/event reuse conflicts.

**[ASSUMPTION]** #117 names `source_ref` without defining its wire shape. The
minimal internal consumer currently requires `{kind: reading|lot, id: UUID}`.
#117 must reconcile that shape when adding the real collection handler. No
`sample.collect` handler is registered by #118, so unrecognized sources remain
rejected by the existing sync registry. This service never fabricates an event to
make a shipment selectable. Location records physical reception context; it is
not an invented field-capture location.

#117 still owns collection payload validation/sync acceptance, evidence purposes,
reception commands, result attempts, explicit missing/invalid/positive/negative
states and valid prevalence selection. Existing immutable source clocks,
rule/catalog provenance and original ingest verdict remain untouched.
