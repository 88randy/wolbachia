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
