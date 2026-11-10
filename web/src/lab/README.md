# Laboratory egg counting (W35, #31)

Technical choices are recorded in [decision 166](../../../docs/decisions.md).

Routes: /lab/egg-counts (egg_count.create) and /lab/count-history
(egg_count.read). The Lab home links only authorized actions. Filters, sorting
and paging use the shared server-driven DataTable/FilterBar and URL state.
Scanning a human Bag code uses the exact code filter; Enter submits the
focused numeric field. Zero is an authored observation. Counts advance only
after a committed response, using its next_bag snapshot.

Concurrency rule: one synchronous write mutex per mounted editor; commands carry
the server CAS revision and a stable UUID for an identical payload. Session
guards reject late responses after identity/revision changes or unmounting.
All reads are orgScopedQueryOptions. Drafts are sessionStorage-scoped to the
user, organization and target; API responses are never persisted.
An ambiguous response keeps the value and offers an explicit replay of the
complete command while the editor remains mounted. Reload restores the numeric
draft and current server queue; it does not recover a previously confirmed-high
command for replay. The CAS revision still prevents overwriting another result.

The server owns plausibility: lab_confirmation_required opens an explicit
confirmation step without a client threshold. Corrections use current
void-context plus one POST void request containing a same-Bag replacement.
Correction additionally needs catalog.read to load the canonical reason choices;
without it the control explains that an administrator must review access.
Every reason needs the canonical catalog code and a 10-visible-character note.
No PATCH/PUT/DELETE is used; include_voided displays retained original values.

Design deviations: no numeric field egg count, field/lab comparison, 10% rule,
viability, rejection or recount execution. Those are outside #31 or contradicted
by its domain rule. No sample names, metrics or default scientific values.

## Existing API limitations

- Queue entries do not contain block, reading timestamp or collector. Optional
  authorized Bag/Reading/Ovitrap/SamplingPoint/Block reads provide provenance.
  Without those existing read grants, the count remains usable and explains the
  missing metadata. Collector and counter are UUIDs; no action-scoped display
  labels exist in these projections.
- W4 universal history has no route/component/API in this checkout. W35 provides
  its existing egg-count history endpoint, preserving author/time/value/ordinal.
  Backend Lab history publishing remains the owner's responsibility; this web
  change cannot certify that integration.
- LabCount exposes a void flag but no void author/time/reason. These details
  cannot be displayed by the list without a backend contract addition.
  Global history and the correction dialog identify the target by the returned
  Bag UUID; the count list does not provide a human Bag code.
- A 409 has no counter/time. A caller with egg_count.read reads the current
  authorized count; a caller without it gets an explicit restricted-context note.
- The server, not a client hard-coded parameter, decides whether confirmation is
  needed and records actual command actor/time.

## Validation

W35Page.test.tsx and count-recovery.test.tsx cover keyboard/confirmation/advance, strict integers, network
replay, concurrent capture, access, states, English accessibility and immutable
correction. count-value.test.ts owns pure integer edges; w-35.spec.ts owns the light/dark,
es-MX/en, 30% expanded text and 320px layout/keyboard matrix.
count-a11y.test.tsx protects the correction target identity, live failure feedback
and distinct announcements for consecutive confirmed counts. The UI review against
ui-ux-standards sections 15 and 16 found and fixed these regressions. Physical scanner,
assistive-technology qualification and W4 consumer integration remain unverified.
Runtime and browser layout checks use the locked workspace packages. Local
verification and CI results are recorded in PR #320.
