# catalogs

Per-organization option lists (incident reasons, removal reasons, the motorcycle checklist...) that admins edit and phones download. Issue #3. Contract: [`docs/api-conventions.md`](../../docs/api-conventions.md) (rows "Catalog items" and "Field snapshots").

## Rules of this app

- Catalogs and items are configuration, not records: nothing is deleted. An item is **deactivated** (old records keep showing it) and can be **reactivated**.
- Every catalog that is open ends with the fixed "Other (specify)" item (`is_other`). The database guarantees one per catalog and that it stays active (`CheckConstraint`); the service answers `409 other_item_cannot_be_deactivated`. Its labels/icon/order/photo flag are protected too (`409 other_item_protected`). It is always listed last, whatever its `sort`.
- Catalogs are created by the seed (`catalogs/seeds.py`), so there is no `POST /catalogs/`. OP01 confirms the nine launch catalogs; the additional #80 void-reason catalog is retained under decision 91.
- `code` identifies an item and never changes (lowercase; `other` is reserved for the seed). Reordering uses conditional `POST /catalogs/{slug}/items/reorder/`; individual `PATCH {sort}` remains supported; `sort` is 0 to 10000 and an exhausted automatic order answers `sort_exhausted`.
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

Admin item projections expose `protected` (fixed Other), integer `usage_count` and
compatible `in_use = usage_count > 0`. Correlated Subquery counts (Coalesce to zero)
sum MotorcycleCheck FKs and, for void-reason, every organization-scoped model with
void_reason_code. Historical references count even after item deactivation; no
per-item queries or join multiplication. Lists select_related both authors.
Reads include created_by/created_by_username and nullable deactivated_at,
deactivated_by/deactivated_by_username. Seed authors are null. Deactivation records
the request actor and time; activation clears both. Repeated state actions are no-ops. Inactive items remain
readable in admin lists/details; deactivation never rewrites their labels or
history. Field snapshots continue to omit inactive choices and retain Other last.

The closed motorcycle-check-item list seeds brakes, tires, lights, horn, mirrors,
fuel. The closed ovitrap-finding list seeds intact, dry, damaged, missing. They
contain actual choices at launch, never an empty checklist. **[ASSUMPTION]** These
concrete initial safety/finding codes implement OP01's required nonempty lists;
the program entomologist should validate labels/content before pilot. Reruns use
get_or_create and preserve labels, order and deactivation. The seven OP01 open
catalogs keep fixed Other; #80's additional open void-reason remains unchanged.


## Seed/request lock order (#99, adversarial round 2)

The mutating seed is one transaction, including standalone seed_default_catalogs
calls. It first locks Organization with select_for_update(no_key=True), then
locks each Catalog with select_for_update() before checking or inserting any of
that catalog's items. Closed launch items, open-list Other and void-reason seed
items all follow this order. Nested organization seeds retain NO KEY UPDATE;
they must not upgrade it to FOR UPDATE. Read-only dry-run planning does not write
items or acquire mutation locks.

The seed's order is Organization NO KEY UPDATE -> Catalog FOR UPDATE -> item
reads/inserts. create_catalog_item also locks Catalog before item existence checks
or inserts. Its deferred Organization KEY SHARE remains compatible with the seed's
NO KEY UPDATE. If the request wins first, the seed waits on Catalog and retains the
committed item's labels/state. If the seed wins first, the request waits on Catalog
before it can query or insert a duplicate code; after the seed commits it returns
400 validation_error with fields.code duplicate_code. The seed's deferred Catalog
FK check cannot wait on a Catalog lock held by a request already waiting on the
seed's uncommitted unique-index entry.

Regression: tests/test_organizations_b_01.py::
test_closed_catalog_seed_and_same_code_request_finish_without_deadlock. Two real
PostgreSQL connections rendezvous at a barrier after the seed inserts brakes but
before commit. A third connection waits for pg_blocking_pids to confirm the request
is blocked by that seed, then releases the seed commit. Both operations must finish,
the request reports duplicate_code, and exactly the original seeded item remains.
There are no sleeps; bounded barrier/event waits and session lock_timeout guard
failure. This test requires PostgreSQL and is not executed in the Docker-blocked
agent environment.

References: [Django row locking](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update),
[PostgreSQL blocking-session inspection](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-INFO-SESSION).
No new dependency, API/schema shape, migration or void-reason validation change.

## Offline finding history (#111)

CatalogSnapshot archives exact delivered content by organization/version hash,
with author/timestamp, ORM immutability and SQL UPDATE/DELETE guard. The selector
build_catalog_snapshot stays pure; history.remember_catalog_snapshot is called
by GET /field/catalog/ before its response, including 304. Ovitrap handlers resolve
choices/labels/Other flags from that submitted version. Pre-archive hashes review
without effects. Retained deactivated choices review, never bind to a new identity.
Seeds add closed-house/absent/destroyed and protected Other to ovitrap-finding, plus
paddle-type (standard + Other), preserving administrator labels and deactivations.
