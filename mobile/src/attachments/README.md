# Private evidence transport (#246)

One immutable evidence UUID identifies original bytes, their SHA-256/type/size and
their proven issuer/organization/user/device owner. This journal transports files;
the existing event outbox remains the only event queue. Native acquisition is
[a separate implementation gap (#253)](https://github.com/88randy/wolbachia/issues/253),
not a camera implemented by this transport.

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

New capture UUIDs use canonical lowercase before becoming immutable. The legacy
reference guard compares UUIDs case-insensitively; a spelling change cannot adopt
historical evidence. No existing envelope or historical reference is rewritten.

Migration 10 is additive after canonical 1–9 on the integrated #102 base; it adds
the file/context/binding journal, immutable identity/metadata/retention guards and
indexes for pending physical dependencies and legacy UUID lookup. It does not
support automatic conversion/reset of databases from older unmerged draft APKs.
The #138 production bridge remains pending serial integration: do not copy its
physical projection, authority CAS, migrations or receipt SQL into this feature.

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
