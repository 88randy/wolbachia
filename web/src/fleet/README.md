# Fleet (W20-W21, #156)

Permission-scoped motorcycles list and human-code record. See [web README](../../README.md#w20-w21-fleet-156) for the supported #72 contract, B-05 follow-ups and verification boundaries.

- `fleet-query.ts`: the single query-key/invalidation boundary, scoped by session identity.
- `use-motorcycle-action.ts`, `use-send-motorcycle.ts`: one guarded write attempt, never replayed.
- `MotorcycleReasonDialog`: shared void dialog and validation with local action translations.
- `use-fleet-tabs.ts`: flat tab links preserving the list search.
- `*.test.tsx`: acceptance behavior, conflict evidence and deterministic session races.
