# Private evidence (B-04 / #102)

## Certification evidence (#101)

One additional concrete AttachmentLink parent is Certification. Keep every prior
parent unchanged. Stage, PUT and finalize verified unbound JPEG/PNG bytes outside
domain locks; the real certification writer then consumes owned/device-matching
declared uploads with training.manage AND field.upload for its whole context.
Certification/final binding/exact command commit atomically. A certificate target
can be retried only after that real fact exists, without another upload system.
Download uses current training.manage before and after unlocked I/O. Operational
training.read and a past issue/verification do not grant private proof access.

## Review integration (#113)

AttachmentLink has FOUR nullable parents with EXACTLY ONE required: field_event,
motorcycle_fault, incident or review_item. New nullable review_item and its tenant
guard never migrate/reparent old evidence. Context review_item binds only the exact
currently authorized item. Supplemental proof cannot replace a source's original
declared UUID/uploader/device binding. Already-bound evidence follows REAL parent
read authority; follow-up case links never grant access. Verification/sorted locks
and before/after-I/O download authorization remain, without storage/ACL bypass.

Binding replay and existing-link reauthorization share one explicit four-parent
resolver (#281). A review-only link keeps its real review UUID through authorize,
renew, PUT and finalize; it is never treated as incident/None. Same-target replay
keeps the immutable link, a different authorized target returns
`upload_already_bound` (`409`), and malformed/ambiguous links fail closed (`404`). Current
review subject-vector scope must grant both review_item.decide and field.upload
for attach/byte mutations. Downloads separately require current review_item.read;
verification and a retained link grant no durable access. Existing parent ACLs,
locks, default grants, audit records and exactly-one-parent SQL guards are unchanged.

Private local storage, not S3. No MEDIA/static route exposes the evidence root;
git and the backend Docker build context both exclude private_uploads/.
Pillow 13.0.0 verifies and fully decodes JPEG/PNG, applies EXIF orientation and
reencodes fresh pixels without EXIF/GPS/XMP/ICC/comment metadata. PNG is normalized
to RGBA so palette/color-key transparency survives metadata removal. Limits: 10 MiB
input/output, 25 million pixels and one frame. No handwritten image sanitizer.

## API and authority

Paths start at /api/v1/. Cookie sessions require CSRF; bearer sessions remain
organization/device pinned. Organization comes from membership, never the body.

| Operation | Request | Result |
| --- | --- | --- |
| POST field/uploads/ | content_type, size_bytes, sha256; optional client_id/context | 201 upload_id, relative url, method PUT, headers, expires_at |
| PUT field/uploads/{id}/content/ | Raw bytes, returned Content-Type/Upload-Lease and current auth | 204; immutable original-byte receipt |
| POST field/uploads/{id}/renew/ | No body | 200 id, state, verified_at plus new PUT authorization; same upload_id |
| POST field/uploads/{id}/finalize/ | Optional context | 200 id, state, verified_at |
| GET attachments/{id}/download/ | Current auth | Sanitized bytes, private no-store/nosniff |

The three-field POST works without context. Unbound bytes can be certified but
cannot download or clear a fault. An incoming field event may consume its own
verified unbound upload under the required-evidence lock; post-_store installs
that exact source binding in the SAME event transaction. This permits uploading
before the source exists, without granting access or accepting an earlier review.
Optional client_id is the immutable organization-scoped offline capture UUID.
Clients declaring evidence UUIDs must
supply it unchanged. Without it, a lost authorization response cannot recover the
new server UUID; capture clients should supply it. Optional context is
{kind: field_event|motorcycle_fault|incident|review_item, id: UUID}. Existing-event binding requires
client_id, that exact declared UUID, source author and pinned capture device.
Fault binding requires field.upload and service_clear, or the capturing fault
author's field_event.sync, in the current motorcycle center. Unassigned motorcycles
need explicit all, matching shifts. One immutable AttachmentLink binds each upload
to exactly one parent; evidence cannot clear another fault/event.

Byte mutations require field.upload and current uploader/device identity. Bound
uploads recheck current attach authority. Downloads instead follow current parent
read/history policy; audit readers need no field.upload. Each action retains its
paired center/quadrant grant. A void alone never erases historical access. Scope,
membership or read-authority loss denies access. Download authorization is checked
before and after unlocked I/O. Certification grants no durable resource access.
Source-event downloads require reading.read for checks, motorcycle.read for fuel
and ovitrap.read for placement/lifecycle history; fault downloads use motorcycle.read.
Owning/writing a capture does not replace its current read permission.
The special parent-read authorization applies only to download; OPTIONS metadata
retains the scoped protocol's default 403 denial.

## Structural concurrency rule

Upload, UploadLease, UploadSource, UploadVerification and AttachmentLink are
append-only with SQL UPDATE/DELETE guards. Tenant/public UUID uniqueness and
one-to-one source/verification/binding enforce one winner. Append-only lease
revisions expire after 15 minutes. Renew invalidates the previous PUT ticket but
retains the public ID and phone file. An existing source can finalize after expiry.

PUT writes a create-exclusive candidate outside transactions. Its entire actual
size and original SHA-256 must match before a fresh short commit installs a receipt.
Competing/retried PUTs can only replay that winner, never overwrite it. Finalize
reads its immutable source into one bounded hashed buffer and passes that SAME
buffer to Pillow. It writes a separate exclusive sanitized object before a fresh
short commit installs verification. Retries return the winner's exact verified_at.
Original and sanitized hashes have separate provenance; no raw key/public URL is
returned. A candidate that may have been referenced is retained BEFORE transaction
exit: COMMIT can persist while its acknowledgement is lost. Never delete possible
committed evidence. Only candidates known never to have been referenced are cleaned
after locks release. Rollback/commit uncertainty, a crash or cleanup failure may
leave a private orphan; retries resolve the immutable receipt. No automatic
retention/destructive cleanup or production-storage certification is introduced.
Original private bytes retain metadata and are never served.

| Caller | Locks / commit boundary |
| --- | --- |
| Authorize, renew, PUT receipt, finalize, explicit bind | User → Device → DeviceSession → TokenPair for bearer → Upload NOWAIT NO KEY UPDATE. Cookie identity rechecked under User. Parent/scope reads acquire no Organization, FieldEvent or Motorcycle lock. |
| Incoming required-evidence gate | Existing account → courier/fan-out → domain locks → sorted Upload NOWAIT NO KEY UPDATE before effects. No extra account/Organization/source lock. |
| Fleet clear_fault | Existing Motorcycle + fresh service_clear scope → sorted Upload NOWAIT NO KEY UPDATE. No new account/Organization/FieldEvent locks beneath Motorcycle. |
| Download | Short identity/authorization transaction → unlocked bytes → short identity/authorization transaction. Immutable bytes require no parent/Upload arbiter. |

Standalone commits set the existing lock timeout and flush deferred FK checks
inside the 429 upload_in_progress map. Sync/fleet retain 429 sync_in_progress and
rollback semantics. No file/network/sanitization/mail runs under SQL locks.
Finalizers never acquire a domain arbiter. Resource access is checked fresh when
binding, consuming or downloading, never inferred from prior byte verification.

## Actual callers and independent references

* clear_fault requires verified evidence bound to that exact severe fault before
  writes. Pending bytes keep it open; later finalize permits a fresh authorized
  clearance, never a different fault.
* Replace/relocate/remove require owned verified evidence before effects. Check
  requires it when the exact archived finding/paddle requires_photo flag is true.
  CheckPayload adds optional evidence_ids default []. Live catalog changes do not
  rewrite historical policy. The existing ovitrap_evidence_required code is reused.
* Optional placement/fuel references may link for history. They gain no new
  required-evidence gate or automatic fuel-status rewrite.

field_sync._store materializes evidence-only links AFTER source verdict insertion.
An in_review source retains its declared UUID independently of operational writes.
Existing metadata binds in that hook; later metadata/finalization explicitly binds
the same declaration. Finalized-first evidence is locked before effects and bound
after source insertion. Late verification never accepts review or rewrites ingest
status, payload, clocks or rule/catalog provenance. #113 owns review acceptance.
Prior review signals produce no effects.

Optional post-_store linkage takes no new SELECT Upload lock after effects. The
immutable OneToOne identity arbitrates append/replay; an existing different-parent
binding is retained and supplies no readiness proof. Unique/FK waits stay bounded
inside sync_batch's outer atomic/429 mapper, so contention rolls back ALL events,
effects and feed changes of that batch. Required gates retain sorted Upload NO KEY
UPDATE locks through _store; finalizers cannot acquire those conflicting arbiters.
NO KEY UPDATE permits link FK KEY SHARE checks, avoiding an unnecessary inversion.
The deterministic pipeline regression covers both compatible FK checks and a held
unique insertion which must roll back the batch before retry/replay.

Uploads do not opt into the revoked-session final-upload capability. That capability
is for bounded JSON sync, whose locks span the request. Bytes need new valid auth;
clients retain local files and retry/re-authorize without recapture. Existing final
sync receipt/session-end ordering is unchanged. #246 owns mobile AttachmentTransport
and checkPayload evidence serialization: no native upload/camera/end-to-end claim.
Purpose notice and avoiding routine faces/household names/documents remain client
requirements.

## Tests and dependencies

../tests/test_uploads_b_04.py covers actual synthetic images/private temporary files,
lease/replay/failures, exact-fault clearance, both source/metadata orders, archived
photo gates, HTTP scope/isolation, current download revocation, SQL guards, deferred
FK rollback and Event barriers for renewal, permission loss and competing finalize.
Existing consumer tests use tests/uploads_support.py to create verification facts
only when they never read bytes; real storage tests remain here. No sleep/fake DB.
PostgreSQL-marked tests/migrations/races require real CI when the engine is absent.
../tests/test_review_upload_parent_281.py exercises the actual public review-parent
lifecycle with canonical review fixtures and synthetic images, same-binding replay,
current attach/read/scope revocation, foreign concealment and reparent rejection.
It isolates only unrelated notice delivery; PostgreSQL collection is not HTTP/SQL
execution evidence. The existing parent and pure image/storage tests remain in B-04.

Official references: https://pypi.org/project/pillow/13.0.0/,
https://pillow.readthedocs.io/en/stable/reference/Image.html,
https://pillow.readthedocs.io/en/stable/reference/ImageOps.html,
https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#png,
https://docs.djangoproject.com/en/5.2/topics/signing/,
https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update.

## Incident parents (#104)

The closed registry also supports incident and declared incident.report / emergency.accident
source references. The new nullable AttachmentLink.incident FK participates in the
same exactly-one-parent constraint and immutable OneToOne identity. A closure can
consume only this incident's bound evidence or its own unique source event's evidence;
unbound owned files bind atomically under sorted Upload NO KEY UPDATE locks. A
different parent's binding is never reused. No storage or sanitizer is duplicated.
Downloads require current incident.read and paired parent scope; in_review-only
sources also require review_item.read. Source void keeps authorized history readable.
Finalization takes no Incident/Organization/source row lock and grants no durable
parent access. Both source/metadata arrival orders retain original ingest semantics.

## Signed custody parent (#106)

The fifth closed parent is transfer_event, an ACTUAL immutable TransferEvent UUID.
HTTP dispatch/receive/resolution evidence binds that parent atomically with the
exact signed manifest. Renew/finalize revalidate the original actor, declared proof,
current action+field.upload over ONE complete transfer vector; recovery/return also
require receive. Download requires whole current transfer.read, never a single
historic leg's scope. Sync signatures/photos retain FieldEvent primary parent and
secondary transfer references; in_review downloads additionally need review.read.
_resolve_link_target still rejects zero/multiple parents and preserves all four
legacy parent policies. No new storage/sanitizer or callback to accept a source.

## Laboratory rejection parent (#114)

lab_rejection is the sixth closed parent in the SAME _resolve_link_target, binding
comparison and download dispatcher. A rejection consumes exact owned verified
unbound bytes under sorted Upload locks and current paired lab_rejection.create
plus field.upload. No storage I/O occurs beneath Lab locks. Current egg_count.read
OR the exact minimal egg_count.void context can download that rejection's retained
evidence; this grants no general Lab list/create/upload or other-parent access.
All five old ACLs, rechecks and immutable bindings remain. Populated Lab downgrade
refuses before removing audit, evidence, origins or history receipts. The existing
private-byte owner adds one Lab consumer case, not another sanitizer/storage matrix.

## Seventh concrete parent: inventory_intent (#107)

InventoryIntent declares exact file UUIDs and signature/rpbi/photo roles before
bytes. The existing authorize/put/finalize pipeline resolves this real seventh
parent, checks current independent field.upload plus the intent's whole-vector
domain action, exact uploader/device/organization and immutable XOR binding.
Operational execution accepts only verified bytes bound to that exact declaration.
Retained download uses current necessary supply/disposal action, independently of
field.upload; identity alone grants no bytes. Source-bound supply files use the
same original author/device and complete-vector source resolver. All six existing
parent branches, sanitization/storage and reparent refusal remain unchanged.
