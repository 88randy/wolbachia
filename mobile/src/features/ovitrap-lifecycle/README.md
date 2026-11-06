# M-09 lifecycle capture (#138)

Implementation plan (owner-supplied issue and accepted lead decisions):

1. Test lifecycle identity/transactions, proposal-only geometry, recovery, feedback,
   correction and restart in `mobile/test/m-09.test.ts` using real SQLite/M-02.
2. Add migration 9 after master migrations 7–8: durable singleton draft, immutable captures,
   evidence references, physical lineage, reasoned voids and local decisions.
3. Implement domain, pinned snapshots, store/ports/service and UUID-bound draft buffer.
   Every command validates displayed identity inside the serialized writer before effects;
   SQL guards arbitrate other service instances. Native continuations revalidate.
4. Add P15-P17 hooks/screens, point-context routes, accessible bottom-sheet confirmation,
   reversible photo Undo, shared tokens and es-MX/en messages.
5. Document ADR 124, design differences, acceptance map and verification limits; run
   root lint/typecheck/format and the configured mobile suite. No commit/push/Docker.

No new queue, transport, dependency or invented B-33 wire contract.

## Architecture and retained history

The implementation follows the plan above. `types`/`domain`/`events` define local
capture and strict B-15 payloads; `snapshots` reads the delivered catalogs/OP03 rules
through M-08's validated readers; `service` owns the writer and native continuations;
`store`/`store-statements` own SQLite/M-02 commits. `physical-projection` resolves
fixed-point lineage for M-08 and M-09. `proposals` retains local decisions, every void
attempt and its delivery outcome. Small presentational components consume hooks,
shared tokens and the existing `useT` adapter.

The race rule is structural: validate the displayed UUID before buffered input is
flushed; inside the writer validate before and after awaiting departure authorization;
revalidate native continuations; conditional SQL/slot guards reject another writer.
`null` means no draft was displayed. Buffer rebind happens immediately after begin
commits, before a fallible snapshot read. No cleanup depends on that read succeeding.

Replacement UUID reservations survive abandoned/superseded drafts and restart, and
M-08 cannot place a reserved lifecycle identity. Replaced/removed sources remain
visible in history; active state derives from effective local events and downloaded
retirement. Explicitly starting a new M-08 capture archives the retired source's
pending draft instead of silently losing it. Navigation deduplicates the same
lifecycle identity, not different traps with the same screen name.

Correction appends `record.void` and preserves the original event, photos and failed
attempts. A rejected void can be corrected again; pending/in-review attempts remain
visible. Proposal `isVoided` excludes rejected/in-review void effects. SQL guards
protect proposal decisions, replacement dependents and removal occupancy across
M-08 placements, lifecycle replacements and current downloaded identities.

## Acceptance map

All issue-specific tests are in `mobile/test/m-09.test.ts` (23 test cases). There is
no new mobile e2e infrastructure. Each test protects one criterion or a distinct
integration/concurrency invariant; no framework-only snapshot tests were added.

| Criterion / invariant | Test title prefix |
| --- | --- |
| AC1 fixed point code, lineage, physical UUID reservation and navigation | replacement retains fixed point code/lineage and reserves fresh physical UUIDs |
| AC1 proposal-only geometry, incomplete GPS/photo/Other | offline relocation is Proposed, retains geometry and requires GPS/photo/Other |
| AC1 explicit recovery including unconfirmed wire mapping | removal requires an explicit recovery choice |
| AC2 decisions/tasks, reasoned correction and service restart | synced decisions/task and reasoned correction preserve proposal/evidence |
| AC2 OP03 pinned values and cross-lineage local weeks | advisory thresholds use delivered values and fixed-point local epi weeks |
| AC2 rejected correction attempts remain truthful and retryable | rejected void attempts retain history and do not mark a proposal voided |
| AC2 removal restoration cannot overwrite occupancy | removal correction cannot restore occupancy over a later local placement |
| AC2 capture begun before configuration can recover | a draft started before configuration can adopt later downloaded catalog and rules |
| AC3 atomic failure preserves original draft/photos and no Saved | failed lifecycle transaction retains draft, references and truthfully pending state |
| AC3 all 10 commands require displayed UUID | every lifecycle command rejects the wrong displayed UUID before write or native effect |
| AC3 cold SQLite reopen, permission wait, interrupted outbox send and one original UUID retry | cold SQLite reopen retains lifecycle draft and interrupted outbox send |
| AC3 buffer/action/native continuation cannot cross draft identity | stale displayed action cannot flush another draft's buffered input |
| AC3 departure await barrier before native effects | a draft switched during departure authorization rejects before native ports |
| AC3 owner binding and additive courier projection resolution | downloaded projections bind owner and resolve new physical UUID |
| AC1 M-08 integration, retired-source archive and current evidence | M08 checks the replacement physical identity and blocks the retired source |
| AC3 M-02 sync wiring applies projections before receipt/cursor advancement | existing sync applies retired/current projections before receipt and cursor advancement |
| AC3 bootstrap/revocation retains drafts, outbox and evidence, and rejects stale writers | bootstrap retirement and revocation share the projection gate |
| AC3 additive upgrade preserves released M-06 assignments and capture enrollment | master schema 8 retains M06 assignments and event enrollment |
| AC4 localized P15-P17 forms/footer/reason/removal-sheet host props | P15-P17 localized native props preserve labeled large controls |

The last test compiles the actual component modules using the installed root
TypeScript compiler and substitutes native host props only. It checks the es-MX/en,
light/dark, 100%/130% configuration matrix, labels, >=48 dp minimum control heights,
wrapping/scaling configuration, modal semantics and preserved save/cancel/remove
controls. It is not a native renderer, layout measurement, TalkBack run, contrast
measurement or device certification. No new dependency is installed.

## Contract assumptions and design differences

See `mobile/README.md`, M-09, for the full S09/S15/S16 comparison and M-01/M-02/B-04
boundaries. In particular:

- **[ASSUMPTION] B-33 is unavailable:** `RelocationDecision` is a local typed
  projection with an immutable id, proposal event UUID, approved/rejected status,
  decision time/reason and optional synced task value. `ingestDecision` is a local
  ingest seam, not an API, authorization action or invented changes payload. A
  future generated B-33 wire schema/producer must connect it to the existing sync
  changes/bootstrap mechanism. No decision/task is inferred from a sync acceptance.
- **[ASSUMPTION] unconfirmed recovery:** retained as local tri-state; the current
  strict B-15 boolean receives false. No UUID/photo, incident app or stock effect is
  invented. Findings abandoned/removed pass their delivered codes for backend linking.
- **[ASSUMPTION] native qualification:** existing unavailable M-08 GPS/evidence and
  assignment ports remain unavailable by default. No missing GPS/photo is fabricated.
  The generated client, native store/navigation and real upload compatibility still
  require the M-01 qualified build.
- Incoming B-13 point/ovitrap sections use generated schemas inside the existing
  M-06 DayStore projection transaction and DayBundleService writer gate. Bootstrap
  replaces downloaded physical/point projections together with assignments and its
  cursor. Deltas apply before receipt/cursor advancement; replay is idempotent.
  Session/scope revocation clears these downloads and M-08 assignment authorization,
  while retaining drafts, outbox and evidence. Existing invalid-cursor recovery
  bootstraps before retry. Native M-01 qualification remains separate.

P15 uses a reserved phone UUID instead of a stock-scan assignment not supported by
this baseline. P16 never moves geometry or assigns tomorrow's task on local save.
P17 adds an explicit unconfirmed choice and keeps final paddle handling in M-08.
Continuous wrapping forms, reason bottom sheets and persistent reversible photo
Undo replace the sample multi-step stock/paddle layouts. No native alert is used.

## Verification boundaries

The initial implementation used owner-supplied issue text after an HTTP 401.
During integration, `gh issue view 138 --json number,title,body` succeeded and
confirmed the live specification. No remote review/CI approval is claimed.
The initial implementation did not publish, merge, or run Docker, backend API,
emulator or device checks. Current master integration is documented below.
Root lint/typecheck/format and configured mobile/i18n test results are recorded in
this task's handoff; actual TalkBack/130% layout/light-dark device evidence and
camera/GPS/SQLCipher/upload/B-33 producer integration remain unverified.


### Executed local checks (initial implementation)

| Command (Windows `npm.cmd`) | Final result |
| --- | --- |
| `npm run lint` | Passed, root workspace |
| `npm run typecheck` | Passed, mobile/web/api-client/i18n/tokens |
| `npm run format:check` | Passed, root workspace |
| `npm test --workspace=mobile -- --test-concurrency=1` | 208 passed, 0 failed/skipped; 17 M-09 tests |
| `npm test --workspace=packages/i18n` | 13 passed, 0 failed/skipped |
| `git diff --check` | Passed |

Initial code/security reviews identified stale native invocation after a departure
await, downloaded-projection owner binding, M-08 replacement resolution, correction
receipt/dependency handling and configuration adoption. Deterministic regressions
reproduced the affected behaviors and passed after fixes; no final independent
review approval or remote CI is claimed. The final direct npm test commands exited
zero; an earlier PowerShell redirected run reported npm stderr notices as a shell
error despite green TAP, so it was rerun directly rather than counted as success.


## Adversarial retirement state hardening (#138)

`physicalIdentityStateSql` is the single retirement-state authority for physical
projection reads and transactional checks. A downloaded ovitrap projection replaces
its assignment snapshot's retirement flag when present, including explicit false
following a server void. Without that projection the assignment remains fallback.
Downloaded point retirement and current effective local replace/remove events then
apply; rejected/in-review lifecycle events and voids never create applied effects.

M-08 resolves that state before saving. Migration 10 replaces both capture insertion
guards and the active-identity view with the same SQL function, so an upsert arriving
after a read-side check still rolls back the whole capture/outbox transaction.
`RETIRED_CAPTURE_DRAFT` uses the same predicate for both archive and slot replacement
inside the existing single transaction. No current retirement rule is duplicated in
JavaScript or in a separate begin/archive condition. Migration 9 stays unchanged.

| Reproduced review issue | Deterministic regression in `mobile/test/m-09.test.ts` |
| --- | --- |
| Downloaded physical/point retirement could still save M-08 checks | `review 1: downloaded physical or point retirement blocks M08 save and stale transactional capture` |
| A downloaded retirement could not supersede the open M-08 draft | `review 2: downloaded retirement supersedes and archives the complete M08 draft atomically` (including write-failure rollback) |
| Stale retired assignment overrode a downloaded active identity | `review 3: downloaded active state overrides retired assignment fallback before current local effects` (including local removal and its void) |

All three tests failed against the previous implementation and pass after the
shared-rule change. No timers, network, Docker or device APIs are needed to control
the interleavings; stale commits and transactional write failure are explicit.

The shared read adapter also accepts a draft point UUID. Pending placement drafts
have no physical projection yet: their current point retirement must still block
save and permit atomic archival/supersession. Review regressions 1/2 include that
placement case alongside physical-check drafts; all use the same SQL predicate.


### Hardening verification

Final root `npm run lint`, `npm run typecheck` (all workspaces) and
`npm run format:check` passed. `cd mobile && npm test` passed 211 tests, with no
failures/skips, including the 20 M-09 cases and the expanded check/place retirement
matrices. `git diff --check` passed. The focused reviewer confirmed the draft-point
context fix by reading; final command execution is the implementer's evidence.

No new wire assumptions or visual changes. Docker/API and Android SQLCipher/device
verification remain outside this local run. No commit or push was performed.


## Integration with current master

Master's released migrations 7–8 remain unchanged and ordered before lifecycle
migrations 9–11. ADR 124 is the next free decision after master's ADR 123.
The schema-8 upgrade regression keeps M-06 retained assignments, original outbox
UUIDs and the existing INSERT enrollment trigger working after the upgrade.

DayStore owns bootstrap, delta and revoke SQL for downloaded lifecycle projections.
Its existing DayBundleService gates serialize bootstrap/sync and reject captured
writers after revocation. There is no second projection writer after that gate.
Revocation also clears M-08 assignment authorization, without removing captured
or pending draft input, immutable envelopes, evidence references or correction history.
Missing additive sections are an empty collection for older B-13 payloads; malformed
present sections fail before cursor advancement. No API contract was changed.

The existing cold-reopen test uses a real temporary SQLite file, closes and reopens
it twice, retains an interrupted sending event and its photo references, and retries the exact
original UUID once. This is Node/on-disk durability evidence. Android force-stop,
SQLCipher/native SQLite, real upload/network/API, TalkBack and the native 130% text
matrix remain UNVERIFIED. B-33 decision/task ingestion remains a typed local seam;
there is no merged decision producer to certify its real-API journey.


## Scope authority and acknowledged-effect reconciliation (ADR 125)

Migration 11 makes current scope an insertion invariant for M-08 captures, M-09
captures and lifecycle voids. The only current capture authorization is the live
`ovitrap_snapshots.assignment`, hidden while durable cleanup is pending. A full
bootstrap intersects its known point/physical context with the explicit downloaded
sections in the same transaction that replaces projections/cursor. Missing capture
context stays unavailable rather than receiving invented week or shift settings.
Draft JSON retains the original assignment, catalog/rules, timestamps and evidence
as historical context. Revocation and commit arbitration both happen inside SQLite;
a stale preflight read cannot authorize a later insert after scope was removed.

Physical state overlays the latest unreconciled local effect in outbox sequence
order, including void effects on both replacement identities. Downloaded point
retirement still blocks every effect. Accepted effects have a durable per-identity
receipt ledger, populated by an outbox status trigger in the receipt transaction.
Its sequence floor is the identity projection observed at acknowledgement, not a
parsed cursor, device clock, assumed server event id or merely the capture time.

A delta reconciles an accepted effect only when `has_more=false` and the identity's
stored projection has a strictly newer sequence than that receipt floor. Until the
feed is drained, older pages cannot undo a locally acknowledged removal. An
existing serialized bootstrap can reconcile accepted effects using its included
identities regardless of local sequence reset. Pending/sending/error effects remain
overlays through bootstrap and restart. The source events/evidence never change.
Migration 11 rebuilds schema-10 identity guards/view so existing installations also
use this rule; it does not depend on rerunning an earlier migration.

The existing reactivation regression now covers pending overlay, accepted results
with lagging pages, full drainage, later server void and authoritative bootstrap.
The existing real-file cold-reopen test also checks receipt-ledger reconciliation
after reopening. The existing bootstrap journey proves both retained explicit scope
and an empty replacement that blocks an unsaved removal without changing its draft.
One new deterministic barrier test revokes scope immediately before the transaction
for M-08 save, M-09 save and M-09 correction; each rolls back the entire new write.
No timer wait or duplicate e2e layer was added. The M-08 fixtures now explicitly
assign their known physical UUIDs rather than saving unknown UUIDs with no point.

Incident-threshold rules can be downloaded, but incident history is not connected
to a merged mobile producer. Only locally known fixed-point closed-house weeks drive
suggestions today. A real incident-threshold journey depends on that backend/history
integration and remains UNVERIFIED; no incident count, authority or task is invented.
Native/device/API/B-04/B-33 qualification limits above remain unchanged.
