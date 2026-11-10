# M10 sample collection (#139 P20)

`sample.collect` schema1 uses the real #117 handler. A sample UUID identifies the
collection; a different immutable event UUID identifies its outbox command. A
strict sample QR supplies only the former. Admission also needs the current
unlocked owner, active normal shift, explicit paired permissions and an authentic
downloaded source, method and origin. Reading and release source IDs are their
canonical operational records, never event or physical Ovitrap UUIDs. Pending
local captures do not manufacture server sources.

The optional `sample_capture` root metadata commits with the existing bootstrap
or changes transaction. Only a complete authenticated bootstrap hydrates this
consumer. Explicit null means known unavailable; a missing legacy field or bad
contract clears positive readiness. Later changes can refresh only an already
bootstrapped matching owner/session/scope frame. Current capture context, profile,
metadata, catalog and rules share the same raw SQLite comparison before writes.
The source snapshot is not a permanent offline permission.

Schema21 appends after unchanged SQL1-20. No-file drafts protect the original
owner. Raw code and Other text persist per edit, including invalid/incomplete
input. The source, start identity and two UUIDs are fixed. Explicit origin/method
selection pins actual archived catalog flags and verified method content/version;
current facts can remove authority. There is no inferred scientific GPS threshold,
seeded method, planned quantity or laboratory result. The actual payload has no
quantity field; P20 follows that contract.

Camera and GPS acquisition run outside edit/projection queues. Native returns
retain their original owner/session, raw draft, scope, profile and shift guards.
An already launched photo may finish privately during a same-owner local lock;
new commands cannot start locked. Changed owner/session/source/profile or a newer
raw edit rejects stale completion. Undo removes only the draft reference; private
bytes remain retained. Save reacquires foreground GPS and seals actual device time,
then atomically writes the immutable event, saved draft and evidence enrollment.
Only the existing SyncEngine, outbox and private-file journal own transport.

Sample JSON waits for its opening and verified originals. Same-shift close JSON
waits for earlier unsettled samples, including future retries; local saves never
wait for a network response. Reopen/retry uses the original UUID and payload.
Rejected and reviewed observations retain their code, provenance and files.

The entry screen lists own retained draft/saved work after restart. A saved item
can restore read-only after shift close under a current authenticated sample
projection. Scope/revocation hides private UI without deleting authored state.
The lab reminder remains pending until a real downloaded receipt matches BOTH
sample and event UUIDs. Missing, invalid or disputed results never mean negative.

| Criterion                                                                                                                              | Test                        |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Original/current method, source clocks, origin/Other and photo gates                                                                   | `sample-domain.test.ts`     |
| Full bootstrap, explicit unavailable, malformed/foreign metadata, raw authority CAS and paired scope                                   | `sample-projection.test.ts` |
| Owner protection, immutable identities, concurrent raw CAS and transaction rollback                                                    | `sample-store.test.ts`      |
| Offline Save, real private adoption, fresh GPS, cold reopen/original retry, rejection, camera barriers, ordering and exact lab receipt | `m-10-samples.test.ts`      |
| Raw UI buffer flush, accessible form/status and restore list                                                                           | `sample-ui.test.ts`         |

These tests use ordinary SQLite, synthetic private files and scripted HTTP. Native
SQLCipher, camera/GPS, force-stop, TalkBack, real API and device qualification remain
UNRUN. No phone is installed or deployed.
