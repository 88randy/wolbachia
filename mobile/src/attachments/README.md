# Private evidence transport (#246)

M10 (#139) declares release evidence_ids through the same journal and field_event
parent. Only Save enrolls photos; Undo retains unenrolled private files. Normal
release JSON waits for verified originals and the opening receipt; same-shift close
JSON waits for earlier unsettled releases, including future retries. The final
upload exception and the single SyncEngine remain unchanged. Capture-time safety
and server review stay independent of file verification or receipt.

M11 (#140) enrolls only the saved fuel event's `receipt_upload_id` through this
same journal. Retaken/adopted-only files remain private and unenrolled. Normal
claim and retry timing require that exact enrolled receipt to be verified, while
null receipts remain explicit pending evidence. Fuel JSON waits for a pending
matching opening; same-shift close JSON waits for
earlier pending fuel to receive an ingest response, preventing a closed-shift
rejection after file/network delay; local close and reviewed-fuel outcomes remain
nonblocking. The final-upload exception and single SyncEngine remain unchanged.

M05 (#134) adopts real PNG signature rasters through the same EvidenceCapture.
Save enrolls only its declared signature_upload_id. Claim/retry eligibility checks
that exact verified signature binding before supplies.receive JSON selection.
Damage photos remain private local-only facts because B10 does not declare them.
No-file receipt drafts participate in the existing owner-activation arbiter.

One immutable evidence UUID identifies original bytes, their SHA-256/type/size and
their proven issuer/organization/user/device owner. This journal transports files;
the existing event outbox remains the only event queue. Camera-only native
acquisition is supplied by [#253](https://github.com/88randy/wolbachia/issues/253);
its adapter delegates durable ownership to this transport. Physical qualification
remains pending.

Capture adopts an exclusive bounded app-owned file and durable journal before
returning a reference. The existing capture transaction binds that reference to
the immutable event. A possibly referenced file is never removed after an ambiguous
write. Declaring the native file port does no photo I/O: path/Directory construction
is deferred to an operation, and directory preparation runs only when creating an
exclusive capture destination. A path, permission or directory-creation failure
rejects that photo attempt, retains its journal error and leaves unrelated sync usable.
Reader/writer cleanup still belongs to the bounded copy operation.
Legacy references without original UUID/session ownership proof remain
local and recoverable; a fresh username match cannot assign them to a new actor.
The pre-login owner CAS and reserve share the SQLite context arbiter. If reserve
wins, another owner cannot activate; if login wins, the old reserve fails.
CredentialStore exposes only durable active credentials, so a failed SecureStore
write cannot make the newly published profile a usable file owner. Proven owner
files survive, and the same User UUID can retry login without relabelling them.

The single SyncEngine recovers interrupted file work and selects eligible events
before claim/LIMIT. All declared evidence IDs require a verified server fact in
normal active sessions. Related blocked work cannot be overtaken, unrelated work
and pulls continue. One bounded file chain runs per pass, using the same engine
retry/hints; there is no second scheduler.
Event retry timers share the claim's SQL evidence/dependency/owner/final eligibility,
before MIN and without the claim's due filter, preserving future eligible retries.
Untransferable legacy declarations remain pending without a zero-delay pull loop.
Final JSON is the documented exception:
it retains receipt-before-cleanup and in-review semantics but cannot upload bytes.
Only immutable outbox declarations enrolled by Save are transport candidates.
Adopted-only photos, Undo/cancelled photos and historical sourceEvidence stay local.
When a durable sent/in-review receipt proves an event exists, authorize/finalize
uses its typed field_event context. A verified file's late binding is confirmed
only after an idempotent response under the current fence; it never rewrites the
event verdict. Lost binding acknowledgements retain the original UUID/file and
retry in the same worker. is_bound is transport metadata, not another event queue.
The 30-second technical deadline spans the entire file turn, including waiting for
shared auth refresh. Expiry invalidates a durable per-file attempt version. The
SessionRequests replay closure checks the expired signal and current attempt /
session again immediately before I/O; shared refresh remains usable by unrelated
work. A late response cannot publish progress under an expired attempt.

Every file/network continuation rechecks its captured owner/session/generation.
SQL CAS arbitrates progress and claims with invalidation. Network/file I/O runs
outside credential, projection and SQLite locks. Verified bytes are not current
scope authorization or a review acceptance. #102 checks current server authority.

M08 acquisition also retains the displayed unsaved draft UUID and originating
live assignment/shift. Native permission/camera and file continuations check those
facts and cancellation; reservation checks the same unsaved draft in the owner CAS
INSERT before any private file creation. Cancelled native work keeps its single-flight
lease until settlement. Local MO03 locking still applies: a permission-induced lock
requires unlock/retry before launch; an already launched same-context camera can
finish privately beneath the opaque AuthGate. Cold uncorrelated pending results
are read and ignored. No gallery, microphone or second durable queue is used.

ImagePicker58.0.10 (MIT, SDK58 bundled range) uses the system camera UI. The config
plugin disables microphone and photo-library permissions; existing Android storage
blocks remain. Asset metadata is advisory; bounded signature/hash verification
still belongs to this journal. `exif:false` omits JS metadata, not metadata in the
original bytes; server #102 sanitation remains required. See
[qualification status](../../../docs/qa/native-photo-253.md).

The adopted result retains an internal SQL authority guard built from the original
capture fence and immutable owned file. M08 consumes it in its final partial
reference UPDATE; a fresh session fence cannot bless an older result. Concurrent
target/assignment/authority changes reject publication while retaining the file
and journal. Whole-draft editors use raw read-version CAS, including Save's atomic
outbox transaction, so neither writer order can overwrite concurrent evidence or
unrelated input. These internal guards are stripped from persisted references.

New capture UUIDs use canonical lowercase before becoming immutable. The legacy
reference guard compares UUIDs case-insensitively; a spelling change cannot adopt
historical evidence. No existing envelope or historical reference is rewritten.

Migration 10 is additive after canonical 1–9 on the integrated #102 base; it adds
the file/context/binding journal, immutable identity/metadata/retention guards and
indexes for pending physical dependencies and legacy UUID lookup. It does not
support automatic conversion/reset of databases from older unmerged draft APKs.
The serial #138 merge retains its physical projection, authority CAS, migrations
and receipt SQL; acquisition consumes those original guards without copying them.

Official APIs: [FileSystem 58](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/),
[Expo fetch 58.0.23](https://github.com/expo/expo/blob/expo%4058.0.23/packages/expo/src/winter/fetch/fetch.ts),
[openapi-fetch 0.17.0](https://github.com/openapi-ts/openapi-typescript/blob/openapi-fetch%400.17.0/packages/openapi-fetch/src/index.d.ts).
File/hash tests use actual temporary files and Node SQLite; transport fixtures use
the actual generated client with scripted responses, not a running #102 backend.
Android persistence/network/TalkBack qualification is not established by these tests.

## No-file lifecycle origin arbitration (#138 M3)

Every nonnull bindSession, preserving its existing isLogin-or-nonnull policy, also
checks the three immutable lifecycle owned fact kinds. A conflicting or missing
owner refuses activation even before a photo was adopted. Explicit new lifecycle
origin checks the ORIGINAL owner/session/generation/is_active binding inside its
same SQL transaction; it cannot late-bind to a replacement actor after an await.
Origin-first blocks another owner; login-first and A→B→A defeat stale origin.
Null/end deactivation remains safe and retains all facts. The real CredentialStore
failure/retry journey also retains no-file origin audit without exposing a new owner.
No new identity store, queue, migration or changes to captured files/envelopes exist.

## M09 Save/Undo enrollment and legacy UUID protection (#138 M5)

The lifecycle bridge passes its displayed UUID into the SAME EvidenceCapture and
accepted session. Adoption durably owns the file before the draft reports success.
Only Save enrolls confirmed IDs with lifecycle/outbox/references atomically; Undo
and unsaved adopted files are never selected by AttachmentSync. Failed writes keep
recoverable journal/files, without delivery or review claims. Camera acquisition
remains #253; native file/network qualification remains unrun.

Runtime reserve excludes case-insensitive lifecycle_evidence as well as ovitrap_evidence.
Local suffix16 adds an index and fresh-reservation trigger to cover direct SQL too.
An already owned/verified row keeps its idempotent no-op and bindings; this never
permits a new draft to adopt a legacy reference or reuse another draft's evidence.
Protected ATTACHMENT_SCHEMA10 and expanded SQL1–15 remain exact.

With #253 composed, the same native port and EvidenceCapture serve M08 and M09;
the camera lease is shared rather than recreated by feature. M09 carries its
original capture context through adoption, and consumes file authority in the
same partial-publication UPDATE as its original draft/owner/scope guard. Only
`id` and `fileRef` enter draft JSON. Every whole-draft writer and Save compares
its raw read version so concurrent photo adoption cannot be overwritten. The
existing M09 AC3 owner verifies both editor orders, quiet cancel and stale Save
rollback/retry using actual temporary private files and ordinary SQLite. Both
legacy evidence reservations and SQL1–16 remain intact; physical acceptance is
still pending.
