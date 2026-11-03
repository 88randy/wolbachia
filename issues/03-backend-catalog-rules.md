TITLE: [Backend] Configurable catalogs and rules per organization
LABELS: backend,priority:high

## 1. Context
The app shows rules but does not decide them. Thresholds and lists (incident types, bike checklist, sample origins, etc.) must be configurable by each organization.

## 2. Goal
Versioned catalogs and rules per organization, downloadable by the phone and editable from Django admin (web UI later).

## 3. Scope / Out of scope
**In:** models, admin, read-only API, versioning (etag), seed data.
**Out:** web screens for editing (web team).

## 4. Data model
- `CatalogItem` (OrgScoped): catalog (enum: incident_type, bike_check_item, sample_origin, community_activity_type, removal_reason, replacement_reason, damage_reason, trap_finding), code, label_es, label_en, icon, sort, is_active, default_severity (nullable), requires_photo (bool), allows_other (bool).
- `RuleSet` (OrgScoped): version (int), values JSON validated by schema: `max_distance_to_point_m=50`, `min_distance_same_block_m=50`, `speed_lock_kmh=10`, `speed_unlock_seconds`, `clock_skew_review_seconds`, `closed_house_weeks_to_relocate=2`, `incidents_to_relocate=3`, `fuel_efficiency_min_km_l`, `fuel_efficiency_max_km_l`, `session_idle_minutes`, `reminder_minutes_before_end=60`. Only one active per org.

## 5. Contract (API / interfaces)
- `GET /api/field/catalog/` → `{version, items:[...]}`; supports `If-None-Match`.
- `GET /api/field/rules/` → `{version, values:{...}}`.

## 6. Behavior
Phone stores the last version; every synced event carries `rules_version` used for local validation.

## 7. Edge cases & errors
- Item deactivated while phones still have old version → server accepts events with that code and flags them `in_review` only if the rule says so.
- Every open list must include an "other" item with free text (`allows_other=true`) unless the rule fixes the options (paddle type, Ok/Fault, severity).

## 8. Acceptance criteria
- [ ] Admin can edit catalogs/rules for their org only.
- [ ] Endpoints return 304 when unchanged.
- [ ] Seed with the values from the design brief.

## Notes
Default values come from the design brief and NOM-032-SSA2-2014 / CENAPRECE guide as cited by the client; **validate with the program entomologist** before production.
