TITLE: [Web] Shared DataTable and FilterBar with URL-synced state
LABELS: web,design

## 1. Context
Most screens are lists: incidents, lots, bags, users, permits and others. The design uses one table pattern:
- removable filter chips;
- right-aligned tabular numbers that link to their records;
- voided rows struck through;
- an empty state;
- server-side export.

## 2. Goal
One reusable table + filter component used by every list screen.

## 3. Scope / Out of scope
**Scope:**
- server paging, sorting and filtering from the query string;
- filter chips + "Clear filters";
- "Include voided" toggle;
- row selection;
- number cells as links;
- loading / empty / error states;
- export button calling the backend.

**Out of scope:** each screen's columns (done in feature issues).

## 4. Data model
The component works with any list response that has `results[]` and paging metadata (page number or cursor, per `docs/api-conventions.md`).

## 5. Contract (API / interfaces)
- Component props: `columns`, `fetch(params)`, `filters` schema, `rowLink`, `exportPath`.
- Query string format: `?status=open&ordering=-created_at&page=2`.

## 6. Behavior
- Changing a filter resets to the first page and updates the URL; the back button restores the previous state.
- Voided rows show a badge, reason and author on hover/focus.

## 7. Edge cases & errors
- Unknown filter in the URL → ignored, with a notice.
- Empty result with active filters → "No results with these filters" + clear action.
- Export larger than the limit → backend job + notification ([PENDING]).

## 8. Acceptance criteria
- [ ] Fully keyboard operable (sorting, selection, pagination).
- [ ] Screen readers announce sort state and result count.
- [ ] Used by at least W6 and W35 queue before being marked done.
- [ ] No client-side filtering of full datasets.

## Notes
- Decided: page number for admin tables, cursor for streams (`docs/api-conventions.md`). The component supports both.
- [PENDING] Table library from #27.
