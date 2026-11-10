# Shared UI primitives

Issue #202, shared kit and approved screen rollout. Components use semantic token variables, translated caller
content, and Radix unstyled primitives. No business or network behavior belongs
here. Import the component from its own file.

- `Button`: `variant` (`primary`, `secondary`, `tertiary`, `ghost`), `size`
  (`sm`, `md`, `lg`, `xl`), optional `leadingIcon` and `loading`, and the native React 19
  button `ref` for focus management. Keep a translated
  accessible name on icon-only controls. Explicit `aria-disabled` actions stay
  focusable and reject activation; `loading` also prevents duplicate submission. Explain disabled actions beside the
  control or with `Tooltip`; a reason must name who can unblock it.
- `Card`: `title`, optional `actions` and `period` slots, `children`, `muted`,
  `className`, `titleId`, and `headingLevel` (1/2/3, default 2). The header keeps
  the title, actions and trailing period selector on one row.
  `CardMenu` accepts translated `items: { label, onSelect, disabled? }[]`.
- `FolderTabs`: `label`, `items: { value, label, content }[]`, optional controlled
  `value`/`onValueChange`, or `defaultValue`. Screens own URL state.
- `StatusPill`, `InlineNotice` and `Banner`: `tone` is `success`, `warning`,
  `critical`, `info` or `neutral`; content is caller-translated. Each status has an
  icon and text. A persistent notice can include an `action` slot.
- `Tooltip`: `content` plus a single focusable `children` element.
- `Dialog` and `SideSheet`: `trigger`, `title`, `description`, `children`.
  Optional controlled `open`/`onOpenChange` props let screens bind the overlay to
  URL state and browser Back. Radix manages focus trapping, Escape and restoring
  the trigger. Use sheets for
  supplementary detail; screens own shareable URL state.
- `ConfirmDialog`: `trigger`, `title`, `consequence`, `actionLabel`, `onConfirm`.
  Use only for irreversible/high-impact actions; Cancel receives initial focus.
  Async business flows own validation and submission outside this primitive.
- `ToastProvider` wraps a shell. `useToast().showToast({ message, tone?, action?,
isBlocking? })` displays at most three notices. `action` is `{ label, onAction }`.
  Additional notices queue until a visible slot opens; an active Undo is never
  evicted. Five-second timers start on visibility, pause during hover or focus,
  preserve their remaining time,
  and never focus a toast. Only blocking errors should set `isBlocking`.
- `Skeleton` reserves its shape immediately and begins shimmering after 150 ms.
  Reduced motion disables shimmer. `TableSkeleton`, `KpiSkeleton`, and
  `CardSkeleton` provide content-shaped loading regions. A loaded view keeps its
  content and adds `Refreshing` while fetching again.
- `EmptyState` distinguishes `kind="noData"` and `kind="noResults"`; pass
  `onAction` and optionally `actionLabel`/`message`, or an `action` slot for a
  real navigation link. Omit an action when there is no authorized next step. The second default action
  clears filters. `ErrorState` takes `onRetry`, optional translated `message`,
  and optional technical `code`/`requestId` in expandable details. Scope it to the
  widget that failed.

Form primitives live in `../forms`: `Select` and `SearchField` retain visible
labels. `ValidatedTextField` takes `validate(value) => translatedError | undefined`
while its caller retains the draft. It validates on blur, then on change after
its first error. Existing `TextField` remains presentational and compatible with
React Hook Form. Submission progress uses the shared `Button`.

Compact card period selectors may use Select hideLabel; their accessible label remains present. DataTable embedded removes its outer frame when a parent Card already supplies the surface; it does not change table behavior.

Issue #218 adds `Switch` (native keyboard behavior, visible label and announced checked state)
and `DialogFooter` (equal-width Cancel/Save tracks, right aligned; stacked only at the shared compact breakpoint).
Use the footer in create, scope, reauthentication, void and irreversible confirmation dialogs.
The shell now mounts the existing ToastProvider so reversible actions can expose guarded Undo.
