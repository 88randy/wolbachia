# Fleet (W20-W21, #156)

Permission-scoped motorcycles list and human-code record. See [web README](../../README.md#w20-w21-fleet-156) for the supported #72 contract, B-05 follow-ups and verification boundaries.

- `fleet-query.ts`: the single query-key/invalidation boundary, scoped by session identity. Supported center filtering uses the explicit URL center before the shell active center, including exact code lookups; both contexts are keyed.
- `use-motorcycle-action.ts`, `use-send-motorcycle.ts`: one guarded write attempt, never replayed.
- `MotorcycleReasonDialog`: shared void dialog and validation with local action translations.
- `use-fleet-tabs.ts`: flat tab links preserving the list search.
- `*.test.tsx`: acceptance behavior, conflict evidence and deterministic session races.

Visual refresh #202: the landing link, list header, record header/summary and
unavailable-history sections use shared `Card` surfaces. Initial record loads use
`CardSkeleton`; failed reads use `ErrorState` with retry and available error codes.
A refresh keeps the existing record visible with `Refreshing` and the existing
verification guard on actions. List loading/empty/error states remain provided by
`DataTable`, with the permission-gated Add action in its header. Status labels use
`StatusPill`, actions use shared `Button`, and record codes/dates use mono tokens.
The native create/reason dialogs keep their existing logic and the shared dialog
CSS; no missing B-05 history, mutation or permission behavior is introduced.
