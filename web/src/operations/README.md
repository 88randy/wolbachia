# Operations (W29/W30/W31/W33, #34, #160)

`/operations` links only to granted shift-validation, review and relocation
workspaces. The review and relocation lists use server filtering, ordering and
paging. `/quadrants/<code>/closure` resolves the exact scoped human quadrant code
before reading readiness by UUID.

See [reviews](reviews/README.md), [relocations](relocations/README.md) and
[closure](closure/README.md) for commands, scope/session isolation and explicit
contract/design limits. All writes are deliberate guarded attempts, never
automatically replayed after reauthentication. No backend contract is changed.

## Shift validation (W29, #34)

Routes: /operations links to /operations/shifts?status=closed. The entry list
uses shared server-paged DataTable/FilterBar; explicit status and page belong to
the URL. No unsupported ordering, client filtering or full-table scan is sent.
The command palette exposes the same permission-gated entry. W28 live tracking
and W30 source review are outside this feature.

### Existing contract

Only packages/api-client is used:

- GET /api/v1/shifts/ and GET /api/v1/shifts/{id}/ require shift.read.
- POST /api/v1/shifts/{id}/approve/ or observe/ require shift.validate and
  {reason, expected_revision}. Both need the server's reason limits from Me.
- ShiftDetail exposes validation and validation_timeline. Shift status remains
  open/closed; approve/observe are separate immutable audits. An old approval can
  become outdated through approval_current=false.
- Blockers prohibit approval; observation remains possible for a closed shift.
  Open shifts prohibit both. Backend paired scope checks remain authoritative.

The contract has no human shift code. The detail route temporarily uses the real
UUID (/operations/shifts/{id}); displayed courier/author UUIDs are labeled as
references. No names, point identities, totals or record links are synthesized.
See decision 166.

### Session and command rule

Queries use orgScopedQueryOptions. The record subtree remounts on user,
organization, authorization context or target changes. A denied detail read
(403/404) removes private facts and drafts; transient errors retain readable facts
with writes blocked. Denied reads replace the cached private snapshot with an
explicit unavailable result, so a later transient failure cannot resurrect it.
The central session error path still handles lost membership. Current Me
permissions also withhold the screen/actions.

Each explicit command freezes its target, kind, reason and reviewed revision.
A synchronous owner prevents duplicate activation. SessionGuard fences requests
and success/error publication, including the continuation that closes the dialog
and announces success. A changed session revision immediately retires the pending
UI owner; its late finally cannot unlock a newer attempt. Reauthentication never
replays a write.

Conflict/uncertain outcomes retain the RAM draft and require a successful read
issued after the failure plus a deliberate reopening of the action. Read attempts
have monotonic sequence numbers, not timestamps. A read issued before the failure
cannot unlock a retry, even if it completes later. The server's CAS is unchanged.
Drafts stay in RAM while the same record/identity is mounted and are discarded
when that owner is retired; audit text is not persisted in browser storage.
Approvals are never optimistic. Success invalidates shifts and shows only
server-returned history, not a fabricated local decision.

### API and design gaps (not implemented or claimed complete)

Compared with design/web/screens/W29-validate-shift.png and B17-Operacion.dc.html:

- ShiftDetail has no point/readings/paddle/eggs/incidents/distance summary,
  GPS track/visit timeline or evaluated flag thresholds/version. Odometer facts
  are shown as odometer facts, not as traveled distance.
- No coordinate feed exists for MapLibre. The screen shows an explicit GPS gap
  and a semantic opening/closing list; it does not draw a fictional route or load
  an unrelated map. The issue's map criterion is pending.
- The server publishes decisions to courier history, but there is no web
  per-point shift-validation projection and W4 is not implemented. The point
  history part of the final criterion remains pending.
- Courier names and server receipt times are absent from this projection.
- The contract supports whole-shift validation only. Partial approval remains
  the issue's client decision; this client adds no per-point command.
- Observation records the real server audit. The web does not claim that a
  notification was delivered or that a courier response workflow exists.

No backend changes, API generation, new dependencies or grants are included.

### Criterion and regression tests

| Requirement | Test in W29Page.test.tsx / shift-validation.test.ts | Limit |
| --- | --- | --- |
| Keyboard timeline alternative | real lifecycle list, keyboard-opened dialog, Escape/focus return | GPS/map pending |
| Observe requires reason | both command journeys refuse empty input; pure reason limits/control/invisible cases | backend remains authoritative |
| Decision in shift history | approve/observe wait for a returned decision and render refreshed real history | point/W4 projection pending |
| Open shift | both actions disabled with explanation, no POST | unit/component only |
| Concurrent validation | 409 retains draft, requires fresh read and explicit reopening, sends new expected_revision | no backend concurrency claim |
| Missing track | explicit gap and available opening/closing list | no coordinates inferred |
| Session/permission safety | readonly/revoked permissions, identity switch, same-identity epoch retirement, late owner, GET403/404 redaction | deterministic deferred replies |
| Unknown outcome | one pending command, no replay; pre-failure read cannot unlock | no real transport certification |
| Partial/error state | failed refresh keeps facts with writes blocked | denied reads redact |
| Bilingual/accessibility | shared catalog tests; semantic axe, labeled forms, Cancel focus; browser journey in `web/e2e/shifts.spec.ts` | synthetic API only |

The focused Vitest command is:

```sh
npm test -w @wolbachia/web -- src/operations/W29Page.test.tsx src/operations/shift-validation.test.ts --maxWorkers=1
```

The W29 browser journey is `web/e2e/shifts.spec.ts`, run with one worker. It checks
both themes/languages, 320 px, keyboard dialogs, error draft retention, real
server-fixture history and expanded text. Browser fixtures are synthetic; they
do not qualify real API transport, backend concurrency or the unavailable map/W4.

Accessibility audits wait for finite UI animations to settle before sampling
contrast; infinite skeleton/spinner motion does not block the audit. The
same-identity regression lets the shell own its read restart and observes the
current revision's successful idle query before explicitly reopening a decision.
