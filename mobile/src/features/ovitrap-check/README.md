# M-08 ovitrap capture

Implementation plan for #137 (owner-supplied specification; no GitHub access):

- Test conditional eggs, strict QR, reuse/correction boundaries in `mobile/test/m-08.test.ts`.
- Implement pure `domain.ts`/`validation.ts`; pinned snapshots and no numeric field counts.
- Add migration 5, singleton draft, immutable captures/evidence/lineage; enqueue through M-02.
- Wire scanner/GPS/evidence/snapshot ports, service, buffered hook and P13/P14/P21 routes.
- Add localized accessible controls, acceptance map and decision 113; run requested root checks.

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
The command runner skips the old-shift buffer only for this explicit new capture,
and discards it only once the draft UUID actually changes.
