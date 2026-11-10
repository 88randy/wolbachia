# Evaluation sheets (W51, #148)

`evaluation.create` and `evaluation.read` independently control entry and history.
The page intersects action codes with explicit scope modes; /me exposes aggregate
display scope, so the backend remains the authority for whole paired grants.
Unknown and foreign evaluation identifiers share the same unavailable read state.
The contract exposes no human evaluation/person codes or action-scoped directory;
the UI labels real UUID references rather than inventing codes or directory access.

Resolve a rubric by its exact code and explicitly select a retained version from
its server-paged history. Display that version's real weights, pass threshold,
critical checks and effective instant. Missing configuration blocks capture;
20/50/30 are backend technical defaults, never a web fallback or a checklist.
All observations send normalized raw section decimals and tri-state critical
responses. Blank sections/checks remain null, and only the returned server result
is displayed. Old attempts retain their original rubric version, observations,
author, timestamps, completion sequence and correction/void reasons.

The confirmation freezes the exact reviewed request. A synchronous in-flight guard
prevents duplicate submissions. Stale session answers publish no receipt or cache
invalidation. Failed/uncertain commands retain fields and require an explicit
history review before a new deliberate command; there is no automatic replay.
Confirmed receipts survive a later history-refresh error. Input stays locked
against the frozen observation until a deliberate new record or reviewed retry.
Identity-owned drafts survive permitted scope changes; a local authorization-entry
guard rejects stale publication across permission/center ABA, without writing
session state. Newly denied original contexts and 403/404 responses retire input.

## Contract gaps

Tracked in [backend follow-up #334](https://github.com/88randy/wolbachia/issues/334).

- No HR cause/intent/publication/transport receipt read is exposed.
  The page labels this unavailable and names administration as the next contact.
  Neither a third adverse result nor a saved evaluation establishes delivery.
  Historical notice-policy rows require both training.manage and evaluation.read;
  their recipient UUIDs never establish current recipient authority or delivery.
- Corrections and voids require the current subject-global completion sequence,
  which is absent from available projections. They stay visibly blocked rather
  than guessing from a paged, scoped result. Existing voided facts still display.
- Standalone attempt responses omit parent/rubric metadata when the matching
  evaluation is outside the current page; this provenance gap is explicitly labeled.
- No B03 export exists. No export URL or extra private permission is invented.

## Acceptance coverage

| Criterion / invariant                                                                                                   | Test                                            |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Server weighting, low/pass/critical/incomplete result and raw null observation                                          | `W51Page.test.tsx`, `evaluation-domain.test.ts` |
| Keyboard errors retain input; irreversible confirmation and no duplicate/replayed write                                 | `W51Page.test.tsx`                              |
| Old rubric/attempt provenance; unavailable notice state                                                                 | `W51Page.test.tsx`                              |
| Independent create/read grants, scoped deep link denial, context cache retirement and late write publication            | `W51Page.test.tsx`, `evaluation-domain.test.ts` |
| W50 certification to W51 capture/history, focus return, live results, axe, both locales/themes, 320px and expanded text | `../../../e2e/w-05.spec.ts`                     |

The inline cards replace B22's fixed columns to preserve every action at phone
width. Sample checklist, scores, counts and delivery claims from the design are
replaced by actual contract projections and explicit unavailable states.
