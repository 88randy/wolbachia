# Laboratory web workflows

## Training dataset exports (W72)

`/lab/annotation-exports` and the Laboratory home card require
`egg_annotation.export`. The form requests COCO or YOLO archives of verified
manual annotations; it never builds training datasets in the browser. Inclusive
dates use the organization's time zone, with at most 366 days and 5,000 images.
The optional author control reuses the existing names-only people picker when
the session may read it; otherwise the author filter is omitted. Voided count
annotations are excluded unless explicitly requested. Points remain pixel
observations in `points.json`, including images without any boxes.

The generated API client submits each job explicitly and downloads its ZIP through
the authenticated download endpoint. Requests use the shared session guard and
organization-scoped query policy. Unconfirmed submissions retain inputs and ask
the user to inspect the table before trying again. History uses server paging and
newest-first order. TanStack Query's `refetchInterval` runs every three seconds
only while the current page contains a queued or running job; terminal and empty
pages stop polling. Download controls explain why they are unavailable until ready.

W72 is the next unused screen code; the original W1–W71 design export has no asset
for it. It follows the existing shared card, form, segmented choice, searchable
people picker, status pill and data table primitives. Copy is in es-MX/en and all
visual values come from the existing shared tokens and primitives. APIs used:
[TanStack Query `useQuery`](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)
and [React state](https://react.dev/reference/react/useState). No new dependency.

| Criterion or edge | Test |
| --- | --- |
| Inclusive range, missing/invalid/reversed dates, leap-year 366-day limit | `annotation-export-domain.test.ts` |
| Poll only while visible jobs are queued/running; stop for terminal/empty pages | `annotation-export-domain.test.ts` |
| Form validation/focus and exact COCO/YOLO/voided request | `W72Page.test.tsx` |
| Ready-only download and authenticated binary request | `W72Page.test.tsx` |
| Permission-gated route, export-only home card and screen axe scan | `W72Page.test.tsx` |

Browser light/dark layout, zoom, narrow widths and assistive-technology/device
qualification require browser/device QA; unit axe coverage does not certify them.

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

| Criterion or edge                                                                    | Test                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Twenty consecutive normalized keyboard submissions retain scanner focus              | `reception.test.tsx`: 20 keyboard scans                |
| Actual scanner command, UUID, returned row, focus and URL-only W35 link              | `e2e/lab-reception.spec.ts`                            |
| No field egg count; boolean observations and no-paddle reception                     | `reception.test.tsx`: received details                 |
| Duplicate/unknown codes and actual no-reading incident link                          | `reception.test.tsx`: duplicate scans                  |
| Explicit missing reason and configuration-pending discrepancy                        | `reception.test.tsx`: expected missing observations    |
| W6/W7 links back to the actual bag's discrepancy view only with reception access     | `incidents/linked-record.test.tsx`                     |
| Enter-delimited FIFO, retained next input and manual recovery after uncertain writes | `reception.test.tsx`: Enter-delimited scans            |
| Live admission refusal retains the pending code and UUID                             | `reception.test.tsx`: unadmitted scan                  |
| A queued scan resumes after reauthentication without waiting for an old response     | `reception.test.tsx`: old-session response             |
| Expected-view placeholders never authorize a missing observation                     | `reception.test.tsx`: switching to expected            |
| Summary links and visible page use the actual server predicates/counts               | `reception.test.tsx`: summary links                    |
| Component-scoped read failure/Retry and denied deep links                            | `reception.test.tsx`: partial read errors / deep links |
| Light/dark, es-MX/en, 320/1280 CSS pixels, +30% text and axe                         | `e2e/lab-reception.spec.ts`                            |

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

### Manual egg annotation (AedesVision)

`/lab/egg-counts/<bagCode>/annotate` uses the human Bag code and current
`egg_count.create` permission. Numeric entry remains available. Photo capture
also needs `field.upload`; the disabled flow explains missing access. A correction
additionally requires the existing read/void/catalog grants and current
void-context. It submits one void command with a same-Bag annotated replacement.
No saved annotation is edited or deleted.

The W35 numeric field and secondary photo-count button share a row when space
allows. Moving to photo counting skips numeric blur validation so an empty
focused field cannot shift the button before its first click.

The upload dropzone starts immediately after choosing or dropping a valid file.
Native file inputs stay hidden: Choose file permits gallery selection without
`capture`; a separate Take photo input uses `capture="environment"` only on
touch/coarse-pointer devices. A thumbnail and stage progress accompany upload;
an explicit retry retains the chosen file and client UUID.

Upload uses the generated private-upload client with the dedicated
`egg_annotation` purpose, SHA-256, raw PUT and verification. JPEG, PNG and WebP
keep the existing 10 MiB/25 megapixel limits. Progress reports the completed
authorization, byte upload and verification stages. Coordinates refer to the
verified, EXIF-oriented image dimensions. Retained downloads use the existing
authorized, metadata-free image, never the private metadata-bearing source.

The native Canvas 2D workspace uses separate image/mark layers, batched paths
and animation-frame rendering. It adds no React peer dependency to the locked
React 19.3.1. See [decision 176](../../../docs/decisions.md) and the
[API mark contract](../../../docs/api-conventions.md#manual-egg-annotations-w35).
One changed gesture is one undo step; selection clicks preserve undo/redo and
recovery seeds a fresh history. History is bounded to 100 steps and
annotations to 5,000 marks. Canvas size follows the viewport, not the source
image's pixel dimensions. The workspace fills the shell content area, with a
420 px canvas minimum. One floating icon toolbar remains over the canvas;
secondary controls move into Actions when the viewport or content column is
narrow. Below 380 px of canvas width the compact toolbar can wrap to keep Finish
and every tool visible. A modal settings SideSheet overlays the canvas without
resizing it. Dialogs sit above the toolbar and return focus to the canvas when
closed. A muted bottom-left pill announces the tool and selection; local draft
status stays inside the workspace without changing its geometry.

The settings Panel (S) is a compact 300 px sheet with a scrollable body and a
fixed header/footer; narrow screens use a bottom sheet. Its tinted summary shows
the plural-aware mark total, mark-derived Box/Point/Mixed mode, density per Mpx,
image resolution and zoom using the current locale. Configuration includes a
Box/Point toggle, box sliders (1 px arrows, 10 px with Shift), five token-color
radio swatches with a check/ring, and the grid switch. Grid size appears only
when enabled: square cells use image pixels (50–1000 px, step 10, default 310 px)
and remain anchored to the paper through zoom/pan. Previously the grid divided
each image dimension into eight parts, so it had no fixed pixel default.

Versioned localStorage preferences retain only box dimensions, marker color and
grid size per user. Invalid values fall back to defaults; changing users replaces
the settings before persistence. Photos and marks remain in their existing draft
store. Panel controls retain focus; its guide button opens the existing three-step
dialog and receives focus again when it closes. Panel and shortcuts dialog render
the same `AnnotationShortcutTable`, including platform-specific Ctrl/⌘ keys.

Boxes use a 2 screen-pixel color stroke with a contrasting outline. Selected
boxes have handles; filled points and handles keep their screen size at every
zoom. Boxes and points may be mixed; every mark counts once.

V/B/D/H select the tools; Space temporarily pans. Wheel/pinch zoom about the
cursor; +/− zoom, 0/R fit and 1 restores actual size. Select moves/resizes marks;
Delete removes the selected draft mark. In every tool, holding the right mouse
button and dragging beyond the 3 px click threshold pans the view, with grab/grabbing
cursors. A right press/release without dragging deletes the mark under the cursor.
Crossing the threshold and returning to the starting point still counts as a drag.
The canvas always suppresses the browser context menu; touch long press never deletes.
Ctrl/Cmd+Z and Shift+Z undo/redo.
On the focused canvas, Enter adds at the visible keyboard cursor, arrows move
the cursor/selection, Shift+arrows resize a selected box, and PageUp/PageDown
or brackets cycle selection. Tab leaves the canvas. G/S/? control the grid,
settings and the separate shortcut table. Actions also opens the table or the
three-step recognition/tools/method guide, whose recognition illustration is
inline SVG. The HTML controls and live counter/selection descriptions
provide keyboard and assistive-technology access alongside the canvas.

IndexedDB stores the authored photo once, with separately debounced marks and
a pagehide flush, scoped to user, organization, Bag and correction target.
Successful metadata writes cannot clear a failed photo write or claim draft recovery.
Successful submission removes the draft; session end and organization changes
purge the database, and opening it purges drafts older than 72 hours.
Reopening explicitly asks to recover or discard; recovery reuploads/reverifies
the same photo before saving. Active elapsed time excludes hidden tabs and time
more than 60 seconds after the last interaction.
API responses and image download URLs are not persisted. Tips are remembered
per user in localStorage and remain accessible through Actions. Save freezes the
mark-derived value and annotation into the existing command writer: CAS,
plausibility confirmation, explicit identical replay of uncertain responses,
conflict handling and the server's `next_bag` remain authoritative. Count history
offers an authorized read-only viewer, including retained voided annotations.

A chosen photo and/or at least one mark is unsaved work until the count is saved.
The toolbar back action, Return to counting, breadcrumbs, shell/menu links and
browser Back all use one [TanStack Router navigation blocker](https://tanstack.com/router/latest/docs/framework/react/guide/navigation-blocking)
(locked version 1.170.46, verified against its installed `useBlocker` source).
Its custom resolver opens the existing app modal, initially focused on Keep marking;
Leave resumes the requested destination without clearing the local draft. Reopening
the same Bag offers draft recovery. Empty editors and successful saves do not block.
If local draft storage fails, the modal explains the possible loss and asks the user
to keep the tab open until saving the count instead of promising recovery.
Only while unsaved, an annotation-owned `beforeunload` listener requests the browser's
standard confirmation for tab close/reload; browsers only allow their native dialog
for that event, so no custom in-app copy or modal can replace it.

| Criterion or edge | Test |
| --- | --- |
| Add/move/delete/undo/redo and bounded mark history | `annotation-state.test.ts` |
| First-click/keyboard navigation from an empty focused numeric field | `count-a11y.test.tsx`, W35 browser journey |
| Outlined boxes, filled points and constant screen-sized points/handles | `annotation-canvas-draw.test.ts` |
| Automatic selection/drop, invalid files, upload locks, gallery/camera split and identical retry | `annotation-upload-choice.test.tsx` |
| Three-step navigation, shortcut table, remembered tips and nested dialog focus return | `annotation-help.test.tsx` |
| Nearest corners, click threshold, unchanged edits and resize viewport preservation | `annotation-canvas.test.tsx`, `annotation-coordinates.test.ts`, `annotation-state.test.ts` |
| Toolbar/compact-menu focus, touch context menu, max-mark announcements, plurals and download lifetime | `annotation-tools.test.tsx`, `annotation-canvas.test.tsx` |
| Right-drag pans in every tool without deleting; stationary right-click deletes; context menu/cancel safety | `annotation-canvas.test.tsx`, `e2e/egg-annotation.spec.ts` |
| Unsaved toolbar/menu/breadcrumb/sidebar exits, keep/leave/default focus, empty/saved exits and conditional beforeunload | `annotation-submit.test.tsx` |
| Real browser Back rollback and confirmation, mouse pan cursors | `e2e/egg-annotation.spec.ts` |
| One photo write, debounced marks, pagehide flush, photo-write failure retention, terminal clear and retired-session write fence | `use-annotation-draft.test.ts`, `annotation-draft.test.ts` |
| Active visible/idle time and side-effect-free replacement command identity | `annotation-active-time.test.ts`, `annotation-command.test.ts` |
| Zoom/pan transforms, cursor anchor, integer clamping and resizing | `annotation-coordinates.test.ts` |
| Image-pixel grid spacing across sizes/zooms; per-user validated preference persistence | `annotation-canvas-draw.test.ts`, `use-annotation-preferences.test.ts` |
| Swatch radio semantics, bounded slider keys, conditional grid size and shared shortcut rows/guide focus | `annotation-settings.test.tsx`, `annotation-help.test.tsx` |
| Mark-derived payload, summary, confirmation and explicit replay | `annotation-submit.test.tsx` |
| Photo upload, mixed keyboard marks, grid/settings and save; light/dark, es-MX/en, 320/1280 px, +30% text, axe | `e2e/egg-annotation.spec.ts` |
| Missing upload permission and actionable field errors with server limits | `annotation-submit.test.tsx`, `annotation-upload-error.test.ts` |
| Explicit draft recovery with 1,000 marks on a 4096 px image, preserved dismissal, zoom/pan and further editing | `e2e/egg-annotation.spec.ts` |
| Authorized history viewer with zoom and no editing tools | `e2e/egg-annotation.spec.ts` |
| Real IndexedDB expiry/session purge/finish cleanup, full-height canvas, visible toolbar, overlay focus and stable draft status | `e2e/egg-annotation.spec.ts` |
| Localized annotation-route breadcrumb | `shell/breadcrumb-path.test.ts` |
| Validation, immutable count/annotation transaction, UUID replay, correction retention and current scope/permissions | `backend/tests/test_egg_annotations.py` |

Browser fixtures are synthetic. Physical phone/tablet pinch, camera capture,
screen-reader qualification and performance on field hardware require device QA.
