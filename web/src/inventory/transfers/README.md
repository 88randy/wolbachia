# Signed transfers and discrepancies (W12–W14, #152)

Routes: `/inventory/transfers[/:code]` and
`/inventory/discrepancies[/:code]`. Human codes resolve through the scoped exact
`?code=` collection before a UUID detail request. Lists use DataTable/FilterBar
and server paging, ordering and filters. No export or HTTP void endpoint exists;
these projections also omit retained source void/review lifecycle (#337).

## Contract boundary

The generated B-09 client supports dispatch, receipt and discrepancy closure.
W12 dispatches **existing prepared transfers**. W13 accepts the explicit line,
piece or lot UUID displayed by that manifest; ambiguous lots require their exact
line/piece identity. Unknown literal codes become uncredited `unidentified_extra`
observations, without a foreign resource lookup. Preparation choices, exact
action-scoped availability, physical QR decoding and human-readable manifest
relations are missing: [#337](https://github.com/88randy/wolbachia/issues/337)
owns that backend contract and subsequent web integration. No backend or generated
artifact changes belong to this delivery.

Signatures are uploaded PNG/JPEG images rather than a drawing canvas. B-04
authorization, same-buffer authenticated PUT and finalization happen **without a
parent context**. Only a server-verified upload enables an action. The transaction
binds proof to its real new TransferEvent; a prepared-event attachment would be
rejected. Signatures and missing-line photos are separate uploads. The history
displays retained manifest quantities, hash and verified evidence references;
it does not download private image bytes.

## Invariants and recovery

- Decimal quantities use scaled BigInt arithmetic, never floating-point stock.
  Each piece is counted once; missing quantities require verified per-line photos.
- The first dispatch/receipt body is cloned and frozen with its `command_id`.
  Only an explicit retry resends it. Reauthentication never replays a POST.
  A confirmed 400/409 can explicitly refresh authorization/current state and
  release the draft for correction. Unknown delivery remains frozen for retry.
- Discrepancy close has **no client command UUID**: backend replay uses its
  discrepancy/revision/body digest. Each outcome covers its complete saved line.
  Recovery/return require new signature/photo proof; extras reference an actual
  separate signed correction receipt. Only backend-owned holds are displayed.
- Query acceptance uses the inventory context fence plus session identity,
  authorization and active center. Every observer and command must own its exact
  current route, including a transient old router outlet. Drafts remain in
  user/organization/code memory across reauthentication and scope/center changes,
  hidden until the fresh current read authorizes restoration. A settled action
  revocation or fresh denied/absent record retires them; user/org/code changes reset them.
  Center selection isolates observers; these APIs have no center filter. Lists
  remain the whole backend-authorized transfer vector. Null quadrant warehouse
  locations are valid; complete paired authorization stays on the backend.
- Upload completion requires the original session/context and mounted uploader,
  then calls the **current** callback. It cannot overwrite scans captured while
  bytes were pending or restore an outcome whose uploader was removed.
  Reception edits synchronously update one canonical draft before publishing
  React state, so same-batch proof/scan callbacks cannot replace each other.
  Resolution signatures use a functional update of the current receiving outcome.
- Committed deep links display saved received/missing facts, without creating an
  empty reception form. Write feedback distinguishes draft scans from server
  receipts, returns scanner focus, and renders safe backend blockers.

## Criterion → test

| Criterion / invariant | Owning proof |
| --- | --- |
| Verified signature/photo, same-file retry and pending/stale proof rejection | `transfer-evidence.test.ts` |
| Exact quantities, missing coverage, duplicate pieces, ambiguous/unknown scans | `transfer-reception.test.ts` |
| Same-batch signature, photo and scan preservation | `reception-draft.test.ts` |
| Lost receipt retry UUID/body, 401 no replay, 409 draft retention/blockers | `transfer-session.test.tsx` |
| Empty/changed scope, permitted draft restoration/denial retirement, opaque codes and committed detail | `transfer-session.test.tsx`, `discrepancy.test.tsx` |
| A transient old outlet cannot read/write the new route | `transfer-route-scope.test.ts` |
| Four resolution outcomes, complete quantity partition and exact close retry | `discrepancy-resolution.test.ts`, `discrepancy.test.tsx` |
| Upload/CSRF/organization wiring and committed scan focus | `e2e/w-10.spec.ts` journey |
| Keyboard/modal focus, axe, contrast, es-MX/en, light/dark, 320px and +30% text | Four combinations in `e2e/w-10.spec.ts` |

Run focused Vitest from `web` with
`node ../node_modules/vitest/vitest.mjs run --maxWorkers=1 --pool=threads --silent=false src/inventory/transfers`.
Run only this browser spec locally:
`npm.cmd run e2e -w @wolbachia/web -- w-10.spec.ts --workers=1`.
Frontend synthetic APIs prove client wiring, not PostgreSQL custody transactions
or operational signature authenticity. Those belong to backend #106 and CI.
