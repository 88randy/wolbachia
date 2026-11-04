# catalogs

Per-organization option lists (incident reasons, removal reasons, the motorcycle checklist...) that admins edit and phones download. Issue #3. Contract: [`docs/api-conventions.md`](../../docs/api-conventions.md) (rows "Catalog items" and "Field snapshots").

## Rules of this app

- Catalogs and items are configuration, not records: nothing is deleted. An item is **deactivated** (old records keep showing it) and can be **reactivated**.
- Every catalog that is open ends with the fixed "Other (specify)" item (`is_other`). The database guarantees one per catalog and that it stays active (`CheckConstraint`); the service answers `409 other_item_cannot_be_deactivated`. It is always listed last, whatever its `sort`.
- Catalogs are created by the seed (`catalogs/seeds.py`), so there is no `POST /catalogs/`. [PENDING #35] The launch list and which catalogs are open or closed.
- `code` identifies an item and never changes (lowercase; `other` is reserved for the seed). Reordering is `PATCH {sort}`; `sort` is 0 to 10000 and an exhausted automatic order answers `sort_exhausted`.
- Limits: 200 active items per catalog (`409 catalog_item_limit_reached`, also when reactivating); `icon` is a token `^[a-z0-9-]+$`.
- `label_en` may be blank: clients fall back to `label_es`. Labels are data, the only user-facing text the API returns.

## Layout

| File | What it does |
| --- | --- |
| `models.py` | `Catalog`, `CatalogItem` and their constraints |
| `services.py` | `create_catalog_item`, `update_catalog_item`, `deactivate_catalog_item`, `activate_catalog_item` (lock the row; `FieldValidationError` for a taken code) |
| `selectors.py` | `list_catalogs`, `build_catalog_snapshot` |
| `permissions.py` | Permission codes of this app |
| `seeds.py` | `seed_default_catalogs`: the nine catalogs and the "Other" item |
| `views.py`, `serializers.py`, `urls.py` | Thin DRF layer; nested routes by regex prefix (no extra dependency) |

## Snapshot

`GET /api/v1/field/catalog/` returns active items only and a `version` hash that is also the `ETag` (`core/versioning.py`). It changes when any label, order, flag or active state changes.
