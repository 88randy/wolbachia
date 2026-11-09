# M-08 ovitrap capture

Implementation plan for #137 (owner-supplied specification; no GitHub access):

- Test conditional eggs, strict QR, reuse/correction boundaries in `mobile/test/m-08.test.ts`.
- Implement pure `domain.ts`/`validation.ts`; pinned snapshots and no numeric field counts.
- Add migration 5, singleton draft, immutable captures/evidence/lineage; enqueue through M-02.
- Wire scanner/GPS/evidence/snapshot ports, service, buffered hook and P13/P14/P21 routes.
- Add localized accessible controls, acceptance map and decision 119; run requested root checks.

One serialized service writer owns draft edits and commits. Database constraints arbitrate
across instances. Correction uses source < void < replacement timestamps, independent of UUID order,
and enqueues void first and replacement plus all projection/evidence
statements in the same existing outbox transaction. No new transport or queue.

See `mobile/README.md`, M-08, for decisions and verification boundaries.

Departure authorization is read live through ShiftOpenService before starting/resuming
and saving. Capture-week identity derives from deviceTime plus downloaded organization
ISO/MMWR and timezone settings, never the assignment package week label. Missing
settings block explicitly. Conditional SQL updates report application; the draft buffer
discards immutable late edits after surfacing the explicit not-saved notice. Retryable
storage errors keep their buffer; a subsequent command can start a capture/correction.

Starting place/check under a different authorized shift explicitly supersedes the old
unsaved draft. Migration 6 archives its complete JSON (including evidence references)
and replacement UUID in an immutable table in the same transaction that replaces the
active slot. Saved events keep their existing append-only projections. Old-shift
edits/saves stay blocked; only new-capture controls use live departure authorization.
The service owns the draft buffer. Each edit supplies its originating event UUID;
merge checks the displayed UUID, and persistence checks the expected UUID inside
the serialized writer and again against the draft used for the conditional SQL
update. A mismatch discards the input and uses the existing explicit edit-not-saved
notice. Retryable storage failures retain input for its original UUID only.

Immediately after `store.begin` commits, the service discards/rebinds its buffer
before any fallible snapshot read. The command runner reports a discarded-edit
notice even when that later read fails. No cleanup depends on action success or a
subsequent read. The command runner skips old-shift persistence only for an explicit
new capture authorized under the current shift.

Round 3 regressions in `test/m-08.test.ts` cover the exact 37/88 buffered-condition
retry after a post-begin read failure, both merge/persist UUID mismatches, and a
second writer replacing the draft during a queued update's read. Deferred promises
control interleavings; no timer waits are used.

## Round 4: displayed capture identity

Every capture command carries the event UUID of the displayed draft/confirmation.
`null` explicitly means the caller displayed no draft; it never means "use the
current draft". Identity arguments are required, including new capture controls,
scanner/manual entry, snapshot refresh/adoption, GPS/evidence, correction and save.
Field input and every step transition pass the originating UUID explicitly.

The action runner validates identity **before** flushing buffered input. The service
validates inside its serialized writer, then checks the identity of the draft read
by the command. Native-port continuations cannot adopt a newer draft. Conditional
SQL edits and the existing capture-slot trigger retain their cross-writer guards.
A mismatch applies no command effects, announces `mobile.ovitrap.staleView` in
es-MX/en and refreshes from the store. If refresh fails, the notice keeps its retry
instruction. Buffered input keeps its original identity. Discard is private buffer
cleanup, never an unbound UI command; historical events remain immutable.

| Criterion | Regression in `test/m-08.test.ts` |
| --- | --- |
| Every service command rejects a mismatched displayed UUID before writes/native ports | `round 4: every capture command rejects another displayed UUID before any effect` (12 command rows) |
| Saving A and beginning B both commit but fail their later reads; engine notifications also fail; Edit on A cannot alter B or flush B's pending input | `round 4: Edit on A cannot change B after both post-commit read failures and engine notifications` |
| Stale action shows its localized notice, reloads B at `point`, and a fresh service resumes B correctly | Same end-to-end local regression, using the production confirmation command and notification observer |

No new dependencies, sync envelope changes or native layout changes.

## Current assignment ownership (#138, unmerged decision draft)

`snapshot-authority.ts` owns every current-assignment write. `saveSnapshots`
updates catalog/rules only, preserving the assignment and its private revision
from the row that exists when SQLite executes the statement. An incoming
`Snapshots.assignment`, including one read before a network wait, cannot restore
authorization. Runtime configuration refresh does not copy a previous assignment.

A genuinely authoritative assignment provider uses `assignmentAuthority` before
its network awaits and `publishSnapshots` afterwards, under the existing pinned
session/origin fence. One conditional `UPSERT ... RETURNING` checks that revision,
publishes the context and advances the revision atomically. It also refuses to
grant points currently marked unavailable by the canonical point cache. A failed
CAS throws `StaleAssignmentAuthorityError` without changing authority, drafts or
outbox. No success is reported for a stale publication.

Bootstrap narrowing, canonical point invalidation and revocation use the same
revision protocol in their projection transaction. They advance even from an
absent/null assignment, preventing an old provider result from exploiting a
null-to-null change. An absent configuration is represented with valid null
catalog/rules/assignment fields. `snapshots()` hides the private revision metadata;
no API, schema migration, queue or native UI flow is added.

The existing M-09 capture/void barrier regression now includes late configuration
and authoritative publication for all three projection changes. The storage ABA
group covers absent/null configuration, and fixture setup publishes explicit
downloaded context through the real CAS instead of a raw snapshot overwrite.

## Private evidence transport (#246)

The production composition adopts a port-supplied capture URI into an exclusive
private owned file and UUID/session-bound journal before returning its reference.
Save binds the current evidence IDs and original outbox event atomically; historical
sourceEvidence remains history. checkPayload now declares current evidence_ids,
matching placement and the backend's additive field. Existing captured payloads
are never repaired or relabelled. Legacy references lacking original User UUID /
session provenance remain local and recoverable, even after a fresh matching login.

The shared engine gates normal events on verified files, while final JSON retains
its explicit in-review exception. P28 shows file pending/error separately from
event receipt; its existing Try now action retries the same engine. The default
camera acquisition port is supplied explicitly by [#253](https://github.com/88randy/wolbachia/issues/253).
See [attachment transport](../../attachments/README.md) and `mobile/README.md` for transport,
integration and native evidence limits.

Camera continuations retain the displayed draft UUID, original accepted actor/session,
live assignment and shift. Exact-current-unsaved-draft reservation is atomic with
the owner fence; no file work occurs under a database/credential lock. Quiet camera
cancellation adds no error. Retired views abort callbacks without pretending to cancel
the OS camera; its single-flight lease lasts until settlement. Pending-photo Undo
removes only a reference from the unsaved current draft, never bytes/history or a
saved envelope. Existing Save enrolls only the retained current IDs in the same outbox.
No shift-open/M09 producer is fabricated: #260 and the #138 production bridge remain
separate. Device/API/accessibility qualification remains [unrun](../../../../docs/qa/native-photo-253.md).

Across service instances, every whole-draft edit compares the exact raw JSON
version returned by its read. A losing same-UUID edit reports a retryable concurrent
edit and retains buffered input; it never overwrites a photo or reports application.
Save checks that version inside the existing outbox transaction using an existing
NOT NULL constraint, so stale capture/history/enrollment inserts roll back together.
Final photo publication mutates only the current evidence array in one UPDATE,
checking the adopter's original owner/session/generation/file authority and the
original target/point/shift/pinned/live assignment in that same SQL statement.
Internal read versions/authority guards never enter serialized Draft or envelopes.

The camera-origin operational shift proof comes from one coherent ShiftOpen read:
the same raw draft/link, opening identity/status/result_code and current catalog/map
both feed the existing gate/captureShiftId and guard the final SQL. No fresh proof
replaces it after acquisition. A severe server review at that last boundary cannot
publish even when the attachment generation and M08 assignment are unchanged.
Benign changes to compared shift facts also reject conservatively and require
retake; private bytes/journal remain. MO01 qualification of this tradeoff is pending.
