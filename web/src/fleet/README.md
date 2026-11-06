# Fleet (W20-W21, #156)

Permission-scoped motorcycles list and human-code record. See [web README](../../README.md#w20-w21-fleet-156) for the supported #72 contract, B-05 follow-ups and verification boundaries.

- `fleet-query.ts`: the single query-key/invalidation boundary, scoped by session identity. Supported center filtering uses the explicit URL center before the shell active center, including exact code lookups; both contexts are keyed.
- `use-motorcycle-action.ts`, `use-send-motorcycle.ts`: one guarded write attempt, never replayed.
- `MotorcycleReasonDialog`: void-only catalog dialog with a forked, local in-use error translation.
- `UnblockDialog` (#186): a required text-only evidence field, no void catalog read/selection.
  `use-unblock-form` reuses GET `/me/` limits and the same normalized visible-character,
  forbidden-character and server-minimum helpers as void reasons. Native modal lifecycle
  starts on Cancel, traps keyboard focus and returns to the trigger. A synchronous attempt
  guard and busy controls prevent duplicate writes; errors retain evidence. Session boundary
  unmount and the existing action guard discard stale completions and never replay a write.
- `unblock-failure.ts`: narrowly retains known unblock conflict codes through the existing
  request adapter: already unblocked and inspection required have distinct localized messages;
  unfamiliar conflicts get a safe generic message. All conflict invalidation stays unchanged.
- `use-fleet-tabs.ts`: flat tab links preserving the list search.
- `*.test.tsx`: acceptance behavior, conflict evidence and deterministic session races.

Visual refresh #202: the landing link, list header, record header/summary and
unavailable-history sections use shared `Card` surfaces. Initial record loads use
`CardSkeleton`; failed reads use `ErrorState` with retry and available error codes.
A refresh keeps the existing record visible with `Refreshing` and the existing
verification guard on actions. List loading/empty/error states remain provided by
`DataTable`, with the permission-gated Add action in its header. Status labels use
`StatusPill`, actions use shared `Button`, and record codes/dates use mono tokens.
The native create/void dialogs retain their existing logic. Unblock uses the same
token-based dialog CSS and form feedback with its dedicated text-only content; no missing B-05 history, mutation or permission behavior is introduced.
