# Training and private evaluations (B03 / #101)

This app owns immutable course/certification facts, action requirements, exact
rubric observations and server-ordered completion episodes. Qualification is not
permission, proficiency certification by software or an evaluation score.
Configured validity/checklists and verified supporting image bytes are required;
technical rubric defaults are 20/50/30 and 80, not operating approval.

Global Training/Rubric writes require one organization-wide training.manage
binding. Facts retain a real Center/applicable Quadrant. Separate actions may use
separate legitimate profiles, but each action covers its whole vector in one
binding. Training summaries never expose private evaluation/evidence/HR details.
History keeps its original context and current read policy. Revocations and
corrections append facts; commands retain exact authorized response/replay/CAS.

The people transaction discovers affected courier/subject/issuer/recipient Users
before sorted User -> Device -> Session -> Pair -> Organization -> courier TRY ->
domain -> Upload locks. Changed preparation aborts; no storage/network/broker I/O
runs under these locks. SQL/race tests require real PostgreSQL CI.

The one existing eligibility slot publishes only current self action/pair
qualification and genuine semantic publication receipts. Pair UUIDs are historical
scalars, allowing canonical token-family pruning; subject identity is retained
independently of a subsequently dissociated Session.user. Root2/history7/supplies1
and every old history variant remain unchanged. No release handler is introduced.

Training notice causes/intents/publication attempts are durable and explicitly
report unavailable routing/transport. They are not Incident rows or proof of
email/push delivery. Existing single-beat recovery observes actual expiry; no
scientific validity, HR contact or delivery SLA is invented.

## Commands and history

The router exposes Training and EvaluationRubric identities/versions, scoped
action requirement versions, subject certifications/revocations, evaluation
creation/revision/void, notice-policy versions and qualification reads.
Every write has command_id and expected_revision. Exact retries reauthorize
retained subjects and replay the original receipt before mutable CAS/state;
changed target/body conflicts. Revision/void also compare the current person's
expected_completion_sequence and preserve the original rubric/context/observations.
`release.record` is an action key, not a qualification or permission default.
Public input failures use field-coded 400 responses before facts commit: instant
fields validate calendar values before checking awareness, and both evaluation
creation and revision reject critical keys absent from the retained rubric.

`GET /evaluations/{id}/attempts/` pages original and successor attempts under
current evaluation.read for the original whole context, including voided cases.
`GET /users/{id}/trainings/{certification_id}/revocations/` pages actual immutable
revocations under training.manage; a subject/certification mismatch is opaque404.
Current evaluation rows include the retained void fact rather than hiding its
reason or replacing the original author. Operational training.read summaries do
not include evidence, attestation, issuer reference or private evaluations.

Evaluation lists accept center/quadrant, subject and include_voided; certification
lists accept center/quadrant, training_version and proof. Requirement and notice
policy lists accept only center/quadrant. A known filter belonging to another
route returns typed unsupported_filter rather than reaching an unrelated column.

TrainingVersion must be effective at the evaluated instant before a certificate
using it can qualify. Its future boundary participates in next_change_at. A
certificate's start may be recorded honestly in the past; recorded_at and the
genuine publication receipt still prevent retroactive capture-proof invention.
No mappings, unverified/missing evidence, unavailable versions and expired or
revoked certificates remain unavailable. Windows are aware UTC half-open intervals.

## Notices and publication

Incomplete evaluations neither increment nor reset a completed-result streak.
Completed low or critical_failure results are adverse; only a completed pass
resets it. A genuine server sequence orders completions independently of
observed_at. The third adverse result retains one cause per episode; later
observations/corrections never erase an intent or pretend delivered recall.
Voiding or correcting a pass reconciles the resulting current episode, retaining
its genuine third completion and original author even when the cause is first
discovered by that correction. It does not fabricate an earlier publication.

Notice policy publication can atomically reroute a bounded list of genuinely
current pending causes with proven nonpublication. It rechecks the current
episode under Organization arbitration even when deferred reassessment has not
run. Ordinary policy edits never redirect old causes. Ambiguous/published states
conflict rather than resend. Missing/currently ineligible recipients remain
explicitly unavailable; expiry uses the active subject and actual valid_to.
Publication and explicit rerouting cover the retained cause contexts plus every
actual context included in the current episode. A fourth adverse completion may
expand that vector without creating a second cause. Retained policies that do
not cover it yield recipient_unconfigured without attaching a private intent;
an A-only actor cannot reroute facts from a later B completion.

Only genuine DeviceBearer bootstrap/normal changes can mint self/session capture
receipts, after prepared account -> Organization -> courier locks and current
whole-pair field.bootstrap AND field_event.sync checks. Cookie/forced/unbound
requests do not mint them, and no-pull/final upload creates no projection or
receipt. Producer reads consume a per-context semantic cache without writes.
Clock-only expiry changes the real bootstrap and change feed before conditional
304; request time/token rotation is not a content-version ingredient.

Evidence uses authorize/PUT/finalize unbound outside domain locks, then real
Certification + verified owned attachment + exact command in one transaction.
Download independently requires current training.manage before and after unlocked
I/O, without granting field.upload to a history reader. PostgreSQL guards and
populated reverse refusal are qualified only by actual CI, not local collection.
