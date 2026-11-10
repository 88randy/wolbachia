# Laboratory web workflows

## Bag reception (W34, #30)

Technical choices are recorded in [decision 169](../../../docs/decisions.md).

`/lab/bags` receives one physical bag per explicit scanner/keyboard submission.
`/lab` links to reception and to the independent W35 `/lab/egg-counts` URL.
W34 imports no counting or recount implementation.

All reads use the generated API client and the shared organization/session query
policy. Private scan state remounts on actor, organization or authorization change.
Each Enter freezes a separate code and UUID in a scanner FIFO. One command gate
serializes writes; session revisions retire the active queue token and a session
guard drops late results. Audit writes are never optimistic or automatically
retried. An uncertain attempted head is removed and pauses the remaining,
unattempted scans until an explicit current-state refresh. The queue removes a
head only after synchronous live-gate admission; refused admission retains its
original code and UUID. Review cancels earlier pending reads before refetching.
No old response can unlock a newer queue token or replace its feedback.

The received-bag, no-paddle, expected and discrepancy lists are server-paged. Their common
filters are exact code, point and week. The API's bag list has no center filter,
so this workspace explicitly uses organization scope and does not apply the shell
center to only one side. Confirmed bag receptions and outstanding expected bags
are independent server counts, not a percentage or an invented delivery batch.

Visible-row metadata uses current, independently authorized reads. Missing
permissions or metadata do not prevent the scanner from working. IDs remain IDs;
no reading number or collector name is inferred. A real no-paddle reading has a
separate UUID-based reception action and never enters the count queue.

Design deviations: field egg counts are replaced by presence and Yes/No flags;
unknown and foreign codes share one response; missing bags are explicit audited
observations with a reason, rather than an invented close-reception batch action.
Discrepancies show configuration pending unless an actual incident exists.

Existing libraries only: [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-options),
[React refs](https://react.dev/reference/react/useRef), and the shared
[Radix dialog](https://www.radix-ui.com/primitives/docs/components/dialog).

### W34 criterion to test

| Criterion or edge | Test |
| --- | --- |
| Twenty consecutive normalized keyboard submissions retain scanner focus | `reception.test.tsx`: 20 keyboard scans |
| Actual scanner command, UUID, returned row, focus and URL-only W35 link | `e2e/lab-reception.spec.ts` |
| No field egg count; boolean observations and no-paddle reception | `reception.test.tsx`: received details |
| Duplicate/unknown codes and actual no-reading incident link | `reception.test.tsx`: duplicate scans |
| Explicit missing reason and configuration-pending discrepancy | `reception.test.tsx`: expected missing observations |
| W6/W7 links back to the actual bag's discrepancy view only with reception access | `incidents/linked-record.test.tsx` |
| Enter-delimited FIFO, retained next input and manual recovery after uncertain writes | `reception.test.tsx`: Enter-delimited scans |
| Live admission refusal retains the pending code and UUID | `reception.test.tsx`: unadmitted scan |
| A queued scan resumes after reauthentication without waiting for an old response | `reception.test.tsx`: old-session response |
| Expected-view placeholders never authorize a missing observation | `reception.test.tsx`: switching to expected |
| Summary links and visible page use the actual server predicates/counts | `reception.test.tsx`: summary links |
| Component-scoped read failure/Retry and denied deep links | `reception.test.tsx`: partial read errors / deep links |
| Light/dark, es-MX/en, 320/1280 CSS pixels, +30% text and axe | `e2e/lab-reception.spec.ts` |

The browser fixture uses synthetic data. It does not qualify a physical USB scanner,
real reception-policy configuration or production data.

## Egg counting (W35, #31)

Technical choices are recorded in [decision 168](../../../docs/decisions.md).

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

### Existing API limitations

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

### W35 validation

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
