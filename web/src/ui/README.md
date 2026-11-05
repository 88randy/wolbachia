# Shared UI primitives

Issue #202, step 1. Components use semantic token variables, translated caller
content, and Radix unstyled primitives. No business or network behavior belongs
here. Import the component from its own file.

- `Button`: `variant` (`primary`, `secondary`, `tertiary`, `ghost`), `size`
  (`sm`, `md`, `lg`, `xl`), optional `leadingIcon` and `loading`. Keep a translated
  accessible name on icon-only controls. Explain disabled actions beside the
  control or with `Tooltip`; a reason must name who can unblock it.
- `Card`: `title`, optional `actions` and `period` slots, `children`, `muted`.
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
  `onAction` and optionally `actionLabel`/`message`. The second default action
  clears filters. `ErrorState` takes `onRetry`, optional translated `message`,
  and optional technical `code`/`requestId` in expandable details. Scope it to the
  widget that failed.

Form primitives live in `../forms`: `Select` and `SearchField` retain visible
labels. `ValidatedTextField` takes `validate(value) => translatedError | undefined`
while its caller retains the draft. It validates on blur, then on change after
its first error. Existing `TextField` remains presentational and compatible with
React Hook Form. Submission progress uses the shared `Button`.
