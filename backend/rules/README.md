# rules

Versioned rule parameters per organization: the thresholds the app shows but never decides (50 m from the point, 10 km/h speed lock...). Issue #3. Contract: [`docs/api-conventions.md`](../../docs/api-conventions.md) (rows "Rule parameters" and "Field snapshots").

## Server table queries (#224)

Parameter lists search `key`, filter `unit`/`value_type` and order by
`key`, `unit`, `value_type` or projected `effective_from`. History searches `reason`,
filters its existing `status` annotation and orders by `effective_from`,
`created_at` or numeric `value`. Existing `include_voided=false` remains the default;
status never expands visibility. Sorting resolves ties with `id`; defaults,
detail/write behavior and field snapshots are preserved. Exact query values,
pagination and error semantics: [configuration table contract](../../docs/api-conventions.md#configuration-table-queries-224).
Focused evidence: `tests/test_table_queries_224.py` parameter and rule-history cases.

## Rules of this app

- No threshold is hard-coded anywhere else: code reads it from here. Sync handlers can resolve values at an event's `device_time` from the existing historical selector; receipt-time clock-skew evaluation is the explicit exception (R03). This does not claim every future handler already uses it.
- A `RuleParameter` is the definition (key, `integer` or `decimal`, unit, optional `min_value`/`max_value`). It is created by the seed only.
- Editing adds a `RuleParameterVersion`; versions are **insert-only** (`core.models.ImmutableMixin`): `save()` of a stored row, queryset `update()`, bulk upserts and the base manager raise `ImmutableRecordError`, and a PostgreSQL trigger (migration `0002`) rejects raw `UPDATE` and `DELETE`. Only the void fields can be written, once. There is no PUT/PATCH/DELETE route.
- A wrong version that has not taken effect yet is voided (`POST .../versions/{id}/void/`, `409 version_not_scheduled` otherwise); it stays in the history, leaves the value in force and the snapshots, and frees its date.
- Value in force = the latest non-voided version with `effective_from <= now`. A parameter with no such version has no value (`null`, "not configured").
- `effective_from` is requested as a local date: today takes effect at `now()` (never retroactive), a future date at 00:00 in the organization's timezone, a past date is rejected and so is one more than 365 days ahead. One non-voided version per future date; several for today are allowed (the latest `effective_from` wins). No regional override.
- Field errors a client can get on `POST .../versions/`: `effective_from_in_past`, `effective_from_too_far`, `duplicate_effective_date`, `not_an_integer`, `out_of_range` (params `{min, max}`).

## Layout

| File | What it does |
| --- | --- |
| `models.py` | `RuleParameter`, `RuleParameterVersion` (immutable), `ValueType`, `Unit` |
| `services.py` | `create_rule_version` (locks the parameter, validates value and date), `void_rule_version`, `resolve_effective_from` |
| `permissions.py` | Permission codes of this app (`rule_parameter_version.read` is the history, admin only by default) |
| `selectors.py` | `get_version_in_force`, `list_versions` (status `scheduled`/`in_force`/`superseded`/`voided`), `list_parameters_with_current` (one query), `get_next_change_at`, `build_rules_snapshot` |
| `seeds.py` | `seed_default_rule_parameters`: the versioned parameters and their accepted defaults |
| `views.py`, `serializers.py`, `urls.py` | Thin DRF layer; nested routes by regex prefix |

## Seed

The 13 launch definitions reuse #88's revisit/day contract. OP03/OP04 and
MO02-MO04 supply reviewed inclusive safety bounds and all missing defaults:

| Key | Default | Unit | Inclusive min | Inclusive max |
| --- | --- | --- | --- | --- |
| max_distance_to_point_m | 50 | m | 10 | 200 |
| min_distance_same_block_m | 50 | m | 10 | 200 |
| speed_lock_kmh | 10 | km_h | 5 | 15 |
| speed_unlock_seconds | 5 | s | 3 | 30 |
| clock_skew_review_seconds | 300 | s | 30 | 3600 |
| closed_house_weeks_to_relocate | 2 | week | 1 | 8 |
| incidents_to_relocate | 3 | count | 1 | 10 |
| fuel_efficiency_min_km_l | 15 | km_l | 5 | 100 |
| fuel_efficiency_max_km_l | 60 | km_l | 5 | 100 |
| session_idle_minutes | 5 | min | 1 | 30 |
| reminder_minutes_before_end | 60 | min | 5 | 180 |
| max_paddle_reuses | 2 | count | 0 | 2 |
| revisit_interval_days | 7 | day | 1 | 28 |

Seed reruns add versions only when none exist and preserve all existing versions,
including deactivated/voided history. Bounds are reviewed definitions and are
updated to the accepted ranges on seed rerun. Historical out-of-bound values are
not rewritten. Fuel min/max edits serialize on the organization before parameter
locks (Organization uses FOR NO KEY UPDATE, including nested seeds) and must remain ordered (min < max) at every scheduled transition; voiding
a scheduled bound cannot invalidate another bound. Conflict is a value field
error fuel_bounds_conflict. Reuse `seed_organization_defaults --apply` for existing
organizations. Before inserting any missing default versions, the seed stages
both proposed fuel defaults together and validates the resulting current/future
non-voided timeline with the same validator used by manual edits. An incompatible
existing or scheduled counterpart raises the explicit value-field conflict
fuel_bounds_conflict (400 validation_error). The entire organization seed rolls
back, including profile grants, catalogs, new definitions, bound updates and
versions. Existing versions and scheduled transitions are never rewritten to make
a default fit. The idle rule is the mobile local PIN/biometric lock, not web/token
expiry. Fuel anomalies mark review, not a capture/shift-close ban.


## Snapshot

`GET /api/v1/field/rules/` returns the values in force, omits future versions, exposes `next_change_at` and carries a `version` hash that is also the `ETag`. The hash is a consistency token; to know what applied at a past instant use the version history.

The version void action takes `{reason_code, reason?}` (#80). The organization's `void-reason`
catalog is resolved before state checks; only `other` requires the #32 text minimum. The
read-only history exposes both `void_reason_code` and `void_reason`.

## Capture accuracy (#111)

Add max_gps_accuracy_m, integer metres, versioned organization parameter through
the existing seed. [ASSUMPTION] default 50, inclusive bounds 1..200 until pilot
confirmation. Existing values/versions remain untouched. Ovitrap safety gates use
the registry historical lookup at device_time and retain applied version ids.
Missing/unusable rules/accuracy review without operational effects. There are now
14 seeded definitions; no existing index-exclusion rule was found.


## Scheduling target (#109)

daily_task_target is a versioned integer count, default 40, inclusive bounds 1..200
**[ASSUMPTION]** until client confirmation. This operational target never caps
captures, task generation or reassignment. Scheduling resolves it at each local
planned date. There are now 15 seeded definitions; reruns retain existing values.

## Local PIN attempt limit (#209)

`pin_max_attempts` is a versioned integer count: default 3, inclusive bounds 1..10,
as specified in #209 for the mobile login's offline PIN gate (#7). The existing
value validator rejects fractions with `not_an_integer` and out-of-bound values
with `out_of_range`, including `{min: 1, max: 10}`. The shared rules snapshot exposes
the value through `GET /api/v1/field/rules/`; bootstrap and sync retain their existing
`rules_version` refresh signal. No bundle field or API schema shape changes.

New organizations receive the default immediately. Existing organizations use
`seed_organization_defaults --organization <slug> --apply`; its dry run lists the
missing definition/default. Reruns preserve administrator versions and append no
second default. There are now 16 definitions. The limit controls local PIN attempts,
not the online login lockout or the mobile password-attempt policy. See ADR 125.

## Laboratory parameters (#114)

lab_count_plausibility_limit is integer/count, default 1000, bounds 100..10000.
lab_recount_sample_per_100 is integer/count, default 5, bounds 1..20: selected
counts per 100 first-pass counts, not a new Unit enum. Existing organization
versions remain; unavailable values are not replaced silently. Count/day snapshots
retain actual in-force version/value/effective instants. Above-OP06 observations
require explicit confirmation AND a real independent request. No method is seeded.
