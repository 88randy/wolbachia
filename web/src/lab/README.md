# Lab reception (W34, #30)

`/lab/bags` receives one physical bag per explicit scanner/keyboard submission.
`/lab` links to reception and to the independent W35 `/lab/egg-counts` URL.
No counting or recount implementation is imported.

All reads use the generated API client and the shared organization/session query
policy. Private scan state remounts on actor, organization or authorization change.
Each Enter freezes a separate code and UUID in a scanner FIFO. One command gate
serializes writes; session revisions retire the active queue token and a session
guard drops late results. Audit writes are never optimistic or automatically
retried. An uncertain attempted head is removed and pauses the remaining,
unattempted scans until an explicit current-state refresh. No old response can
unlock a newer queue token or replace its feedback.

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

## Criterion to test

| Criterion or edge | Test |
| --- | --- |
| Twenty consecutive normalized keyboard submissions retain scanner focus | `reception.test.tsx`: 20 keyboard scans |
| Actual scanner command, UUID, returned row, focus and URL-only W35 link | `e2e/lab-reception.spec.ts` |
| No field egg count; boolean observations and no-paddle reception | `reception.test.tsx`: received details |
| Duplicate/unknown codes and actual no-reading incident link | `reception.test.tsx`: duplicate scans |
| Explicit missing reason and configuration-pending discrepancy | `reception.test.tsx`: expected missing observations |
| W6/W7 links back to the actual bag's discrepancy view only with reception access | `incidents/linked-record.test.tsx` |
| Enter-delimited FIFO, retained next input and manual recovery after uncertain writes | `reception.test.tsx`: Enter-delimited scans |
| A queued scan resumes after reauthentication without waiting for an old response | `reception.test.tsx`: old-session response |
| Expected-view placeholders never authorize a missing observation | `reception.test.tsx`: switching to expected |
| Summary links and visible page use the actual server predicates/counts | `reception.test.tsx`: summary links |
| Component-scoped read failure/Retry and denied deep links | `reception.test.tsx`: partial read errors / deep links |
| Light/dark, es-MX/en, 320/1280 CSS pixels, +30% text and axe | `e2e/lab-reception.spec.ts` |

The browser fixture uses synthetic data. It does not qualify a physical USB scanner,
real reception-policy configuration or production data.
