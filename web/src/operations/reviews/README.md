# Review queue (W30, #160)

The generated review contract separates immutable ingest from append-only
decisions. The server evaluation is mandatory: acceptance never overrides a
permit, training, zone, safety or unavailable historical-authority blocker.
Only a fresh exact nonplaceholder detail and current action/scope hints enable
commands; the backend rechecks the paired grant. The session controller remains
the only identity writer (decision 92).

Filters, ordering, paging and the selected `item` belong to the URL. Reviews have
no unique human code: `code` is a repeatable cause, so the selection retains the
returned opaque review UUID. Original envelope, provenance, evidence references,
author references and exact known effect receipts stay separate from decisions.
The API has no review export or generic evidence download, so none is invented.

Private reasons live in RAM above replaceable reads. Identity or decision-grant
loss drops the owner; explicit scope denials purge the reason and hide evidence.
Permission-only scope changes retire obsolete queries. Current authorization
and center entries also fence late command publication, including A/B/A changes.
Reauthentication, conflicts and interrupted requests never replay writes; an
explicit accepted read is required before another deliberate attempt. Freeze the
reviewed revision and reason while a confirmation is open. Preserve the exact
POST receipt even if the follow-up detail read fails.

Void uses the shared reason dialog. B17 accepts a free reason rather than a
catalog field: the adapter appends the selected catalog code/note to the explicit
decision reason. It never invents `reason_code` or clears a safety disposition.
Inspection-based safety clearance remains in its owning workflow. Original
capture evidence is never replaced by supplementary references.

The detail is an inline card rather than the exported fixed right rail so that
all actions remain available at 320 CSS px. Shared tokens, loading/error states,
tables and irreversible confirmation primitives are reused. Code-based causes
and opaque unknown payloads remain labeled as returned evidence, not invented
human names or navigable records.

| Criterion / invariant                                                                       | Test                                         |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Mandatory acceptance and terminal-decision safety                                           | `review-command.test.ts`, `reviews.test.tsx` |
| 409 retains reason and uses the deliberately refreshed revision                             | `reviews.test.tsx`                           |
| Scope loss, inaccessible deep links and private-draft retirement                            | `reviews.test.tsx`                           |
| Confirmed receipt survives failed refresh                                                   | `reviews.test.tsx`                           |
| R7, real task receipt, closure blockers, keyboard, axe, both locales/themes,320px/+30% text | `../../../e2e/w-19.spec.ts`                  |

No new dependency or API is introduced. Existing primitive behavior was checked
against official [TanStack Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
and [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)
documentation; lockfile versions are unchanged. Synthetic UI/browser fixtures
do not establish live backend authorization, database behavior or deployment.
