TITLE: [Web] Generic catalog editor with "Other (specify)" (W63)
LABELS: web,backend

## 1. Context
Part of epic #23. Open option lists are configurable per organization; examples include incident reasons, intervention types, relocation reasons and the motorcycle checklist. Every open list must end with "Other (specify)".

## 2. Goal
One generic editor for all simple catalogs, with tabs per catalog. Items are labelled in es-MX and en, can be ordered, and are deactivated instead of deleted.

## 3. Scope / Out of scope
**Scope:**
- list catalogs;
- add, edit, reorder and deactivate items;
- labels per language;
- "in use" indicator;
- fixed "Other (specify)" item.

**Out of scope:** incident types (W64, richer form); supply types (W8).

## 4. Data model
- `Catalog(slug, name_i18n, is_open)`.
- `CatalogItem(catalog, code, label_i18n, order, active, is_other, organization_id)`.

## 5. Contract (API / interfaces)
- `GET /api/v1/catalogs/`
- `GET/POST/PATCH /api/v1/catalogs/{slug}/items/`
- `POST /api/v1/catalogs/{slug}/items/{id}/deactivate/`

## 6. Behavior
- The "Other" item is always last and cannot be deactivated or renamed away.
- Items in use can only be deactivated; they keep showing on old records.

## 7. Edge cases & errors
- Duplicate code → `400`.
- Missing English label → falls back to es-MX, with a warning in the editor.
- Deactivating "Other" → `409`.

## 8. Acceptance criteria
- [ ] Every open catalog in the system shows "Other (specify)" last.
- [ ] Choosing "Other" anywhere in web or mobile requires the free text.
- [ ] Reordering works with the keyboard ("Move up/down").

## Notes
- [PENDING] Full list of catalogs at launch and which are open vs closed.
