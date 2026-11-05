# catalogs

Per-organization option lists (incident reasons, removal reasons, the motorcycle checklist...) that admins edit and phones download. Issue #3. Contract: [`docs/api-conventions.md`](../../docs/api-conventions.md) (rows "Catalog items" and "Field snapshots").

## Rules of this app

- Catalogs and items are configuration, not records: nothing is deleted. An item is **deactivated** (old records keep showing it) and can be **reactivated**.
- Every catalog that is open ends with the fixed "Other (specify)" item (`is_other`). The database guarantees one per catalog and that it stays active (`CheckConstraint`); the service answers `409 other_item_cannot_be_deactivated`. Its labels/icon/order/photo flag are protected too (`409 other_item_protected`). It is always listed last, whatever its `sort`.
- Catalogs are created by the seed (`catalogs/seeds.py`), so there is no `POST /catalogs/`. OP01 confirms the nine launch catalogs; the additional #80 void-reason catalog is retained under decision 91.
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
| `seeds.py` | `seed_default_catalogs`: the ten catalogs, default void reasons and the "Other" item |
| `views.py`, `serializers.py`, `urls.py` | Thin DRF layer; nested routes by regex prefix (no extra dependency) |

## Snapshot

`GET /api/v1/field/catalog/` returns active items and the non-voided fleet (`motorcycles`, including blocked motorcycles with their reason, #72), plus a `version` hash that is also the `ETag` (`core/snapshots.py`). It changes when any label, order, flag, active state or fleet content changes. The same hash is sync `catalog_version`; the snapshot keeps `catalog.read` for this compact organization configuration.

## Void reasons (#80)

`void-reason` is open and seeded for every existing and new organization: `data-entry-error`,
`duplicate-record`, `wrong-location`, plus the enforced `other`. **[PENDING] client/entomologist**:
the final item list. Seeds use `get_or_create` by code and preserve admin labels and inactive
states. The existing generic field snapshot includes this catalog automatically. Void storage
keeps the immutable item code rather than a foreign key; deactivation never rewrites old voids.


## Launch metadata (#99)

Admin item projections expose `protected` (fixed Other) and `in_use` (a stored
MotorcycleCheck FK or a recorded void-code reference). Inactive items remain
readable in admin lists/details; deactivation never rewrites their labels or
history. Field snapshots continue to omit inactive choices and retain Other last.

The closed motorcycle-check-item list seeds brakes, tires, lights, horn, mirrors,
fuel. The closed ovitrap-finding list seeds intact, dry, damaged, missing. They
contain actual choices at launch, never an empty checklist. **[ASSUMPTION]** These
concrete initial safety/finding codes implement OP01's required nonempty lists;
the program entomologist should validate labels/content before pilot. Reruns use
get_or_create and preserve labels, order and deactivation. The seven OP01 open
catalogs keep fixed Other; #80's additional open void-reason remains unchanged.
