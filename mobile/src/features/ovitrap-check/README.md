# M-08 ovitrap capture

Implementation plan for #137 (owner-supplied specification; no GitHub access):

- Test conditional eggs, strict QR, reuse/correction boundaries in `mobile/test/m-08.test.ts`.
- Implement pure `domain.ts`/`validation.ts`; pinned snapshots and no numeric field counts.
- Add migration 5, singleton draft, immutable captures/evidence/lineage; enqueue through M-02.
- Wire scanner/GPS/evidence/snapshot ports, service, buffered hook and P13/P14/P21 routes.
- Add localized accessible controls, acceptance map and decision 113; run requested root checks.

One serialized service writer owns draft edits and commits. Database constraints arbitrate
across instances. Correction enqueues void first and replacement plus all projection/evidence
statements in the same existing outbox transaction. No new transport or queue.

See `mobile/README.md`, M-08, for decisions and verification boundaries.
