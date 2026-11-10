# Database startup and schema lineage (#266)

## Additive incident schema19 (#141)

Retained owner-bound incident/accident drafts append after unchanged SQL1–18.
Original UUID, kind, shift, device time and snapshot identities cannot change;
saved captures cannot be edited or removed. No-file drafts participate in owner
activation and local-record detection. REST read caches use existing private KV;
the event outbox and evidence journal remain the only transport queues.

## Additive fuel schema18 (#140)

Schema18 retains owner-bound fuel drafts after unchanged SQL1–17, including
no-photo local origins. One unfinished draft per owner/shift is allowed. Saved
captures, pinned motorcycle/currency/shift identity and evidence are retained.
The existing structural lineage reader derives this prefix from the actual
migration registry; no reset, backfill or historical schema rewrite is introduced.

## Additive receipt schema17 (#134)

Schema17 appends retained owner-bound receipt drafts after unchanged SQL1–16.
A unique owner/release index prevents parallel starts. Owner/identity cannot be
rewritten; a saved draft cannot be edited or removed. Shared owner admission also
checks no-file receipt origins, and local-record detection protects those drafts.
The existing outbox and attachment tables remain the only transport journals.

Read mobile/README.md and engineering-rules.md first. Encryption/key validation
remains in encrypted-database.ts. After it returns, open-database.ts delegates to
prepare-database.ts: structural preflight, existing WAL/FULL, then migrate. Public
migrate independently checks the same profile before its first atomic write.
There is no caller-trusted bypass, repair, reset or new lineage flag.

## One source of expectations

migrations.ts derives profiles from the SAME released arrays it executes.
CANONICAL_MIGRATIONS is an internal readonly fixture view, not another definition.
No released1–11 SQL literal/order changed; their prefix SHA256 remains
15cc0777e1a7692560c0ed32f90662d38aa173aa0a5cf905d07f65a5d134f8f1.

This DRAFT #138 integration appends the three unchanged M09 arrays as12–14.
schema-profile.ts folds only our known CREATE TABLE/INDEX/TRIGGER/VIEW, DROP TRIGGER/VIEW
and ALTER TABLE ADD COLUMN forms; existing data-only statements add no schema.
Unknown source DDL fails closed. schema-table.ts derives column/PK/FK/UNIQUE
metadata from those same known table forms, not a second handwritten signature.

schema-sql.ts tokenizes without changing quoted string values. Whitespace and
keyword case may differ. A quoted spelling can match only an EXPECTED unquoted
canonical identifier; literal tokens retain exact spelling, case and whitespace.
This is bounded to our DDL, not a general SQL parser or affinity normalizer.

schema-lineage.ts reads user_version and every sqlite_master object; table/index/
trigger definitions must match the entire prefix. schema-metadata.ts verifies
columns/order/types/defaults/PK, FK targets/actions and explicit/generated indexes.
SQLite autoindexes are recognized only for known tables and exact PK/UNIQUE
origin/columns/uniqueness/partial signatures. sqlite_sequence is allowed only for
the source AUTOINCREMENT definition and known SQLite structure; there is no broad
sqlite_* exemption. No business view is executed to infer lineage.

## Retained state and refusal

### Additive lifecycle context schema15 (#138 M2)

The registry appends schema15 only. All evaluated SQL1–14 remains exactly bound to
SHA256062f4b955cc867b3b34adb8abb9aa6d0168b590320316579928ee465ff09a34d;
historical builders/constants remain unchanged. New context SQL is isolated in the
versioned lifecycle context-schema/context-sql modules. It adds readiness and
capture/origin/immutable-fact guards in existing KV/projection tables, with no new
table, ownership backfill, adoption, reset or historical JSON rewrite.

An explicit fenced new-start writer generates the UUID and seals immutable origin;
ordinary restore/update and migrations never do so. Unproven legacy drafts remain
unchanged/recoverable but cannot acquire current ownership through hydration/save.
The same source-derived profiles recognize the complete new prefix and continue
rejecting unsupported old numeric-version collisions before OUR configuration or
migration writes. The actual13→14 receipt-backfill test remains separate from its
subsequent14→15 readiness/preservation assertions. Node temporary-file SQLite is
not native SQLCipher, a supported bridge for old unmerged APK data, or device QA.

This draft supports genuinely empty0, complete released1–11 and new complete12–14
prefixes. The new prefixes contain BOTH attachments10 and completion-bootstrap11;
an old unmerged M09 schema with the same version is still refused.
Readiness flags can disappear after hydration; receipts, adoption state, settings,
UUIDs, envelopes and ownership values are DATA and are never relabelled as proof.
Old M09 schemas at8,9–11 and10–12 conflict even where numeric versions or points
coincide. A future version or a partial/mixed signature is not a fresh install.

Refusal issues no OUR configuration/migration writer. The named internal
UnsupportedDatabaseLineageError goes to the existing localized support failure;
logging contains its name, not SQL/payload/key data. Retain the original for an
explicit support decision; do not uninstall/reset/delete/rename/replace it or
guess user_version. No compatibility bridge for retained unmerged M09 is implemented.

## Verification boundary

database-lineage.test.ts uses actual migrate/prepareDatabase with real temporary
ordinary SQLite files, retained synthetic envelopes/KV and reopen/hash checks.
The fixture-only schema-lineage-history.json deduplicates the exact historical
common prefix and four suffixes, with original source refs and SQL-array hashes.
Tests do not import old M09 production code, invoke Git, install a package or need
a remote ref/shallow-clone exception. Canonical0–11, seven old shapes, future/
partial/mixed schemas, missing retention triggers, identifier quoting and literal/
deferred-constraint differences are covered at the same cheap SQL layer.

The extracted orchestration proves reads precede OUR WAL/FULL and migration batch.
It does not execute or certify native open/SQLCipher, SecureStore or Android disk
behavior. The existing native/physical qualification remains owner-authorized and
UNRUN; neither Node success nor an APK build replaces it. Adding a future released
migration requires supported DDL/profile and compatibility tests, never an edit to
an old array or an inferred upgrade of an unknown retained file.

## Authored local work versus downloaded cache (#138 M3)

owner-data.hasLocalRecords excludes only the exact downloaded ovitrap/point,
quadrant/block and four history kinds plus the standalone point cache. It retains
ALL outbox statuses, drafts, shift data, adopted-only files, immutable owned facts
and unknown/private kinds regardless of availability. This reader never deletes
floor storage or changes server-reset/final-cleanup rules. M3's runtime owner/origin
admission uses existing schema15 and attachment_context; evaluated SQL1–15 and its
historical import closure remain exact. No migration/backfill/adoption is added.

## Additive lifecycle evidence reservation guard (#138 M5)

Local schema16 appends only lifecycle_evidence_uuid (lower UUID lookup) and
lifecycle_unproven_evidence_reservation. Fresh attachment_file INSERT cannot adopt
a referenced legacy lifecycle UUID, case-insensitively. Existing owned rows preserve
INSERT OR IGNORE no-op behavior, metadata, verified state and event bindings.
No historical array/helper/SQL1–15, QA data, owner inference, backfill or reset changes.
The registry alone gains import+append; its newly evaluated closure proves the
protected expanded prefix unchanged. #266 derives profiles from the actual registry;
canonical prefix upgrades and unsupported old-lineage refusals remain owning tests.
This is ordinary synthetic SQLite evidence, never SQLCipher/device certification.
