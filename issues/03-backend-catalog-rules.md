TITLE: [Backend] Configurable catalogs and versioned rule parameters per organization
LABELS: backend,priority:high

## 1. Context
The app shows rules but does not decide them. Web admins edit catalogs (W63), incident types (W64) and rule parameters (W62); the phone downloads snapshots to work offline.

## 2. Goal
Catalogs and per-key versioned rule parameters, editable by ADM, readable by every internal client, with compact snapshots for mobile.

## 3. Scope / Out of scope
**In:** models, admin endpoints, field snapshots, seed data.
**Out:** web UI; full `incident-types` model (incidents epic).

## 4. Data model
- `Catalog` (OrgScoped): slug (incident-type, motorcycle-check-item, sample-origin, community-activity-type, removal-reason, replacement-reason, damage-reason, ovitrap-finding, intervention-type…), name.
- `CatalogItem`: catalog, code, label_es, label_en, icon, sort, is_active, is_other (fixed "Other (specify)", cannot be deactivated), requires_photo.
- `RuleParameter` (OrgScoped): key, value_type, unit.
- `RuleParameterVersion`: parameter, value, effective_from, created_by. Never updated in place.
Seed keys: `max_distance_to_point_m=50`, `min_distance_same_block_m=50`, `speed_lock_kmh=10`, `speed_unlock_seconds`, `clock_skew_review_seconds`, `closed_house_weeks_to_relocate=2`, `incidents_to_relocate=3`, `fuel_efficiency_min_km_l`, `fuel_efficiency_max_km_l`, `session_idle_minutes`, `reminder_minutes_before_end=60`, `max_paddle_reuses=2`.

## 5. Contract (API / interfaces)
- Web/admin: `GET /api/v1/catalogs/`, `GET/POST/PATCH /api/v1/catalogs/{slug}/items/`, `POST …/items/{id}/deactivate/` (`409` for `is_other`); `GET /api/v1/rule-parameters/`, `GET|POST /api/v1/rule-parameters/{key}/versions/`.
- Mobile: `GET /api/v1/field/catalog/` and `GET /api/v1/field/rules/` → snapshot with `version` hash, `ETag`/`304`.

## 6. Behavior
Value in force = latest version with `effective_from <= now` (org timezone). Every field event carries `rules_version` and `catalog_version`.

## 7. Edge cases & errors
- Item deactivated while phones hold an old snapshot → server accepts and flags `in_review` only if configured.
- Future-dated version → not in snapshot until effective (snapshot exposes next change date).

## 8. Acceptance criteria
- [ ] Versions never overwrite; history endpoint returns all.
- [ ] "Other" cannot be deactivated (test).
- [ ] Snapshots return 304 when unchanged.
- [ ] Seed with brief values.

## Notes
Default values from the design brief and NOM-032-SSA2-2014 / CENAPRECE guide as cited by the client; **validate with the program entomologist**.
