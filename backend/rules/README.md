# rules

Versioned rule parameters per organization: the thresholds the app shows but never decides (50 m from the point, 10 km/h speed lock...). Issue #3. Contract: [`docs/api-conventions.md`](../../docs/api-conventions.md) (rows "Rule parameters" and "Field snapshots").

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
| `seeds.py` | `seed_default_rule_parameters`: the thirteen parameters and the brief's values |
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
locks and must remain ordered (min < max) at every scheduled transition; voiding
a scheduled bound cannot invalidate another bound. Conflict is a value field
error fuel_bounds_conflict. Reuse `seed_organization_defaults --apply` for existing
organizations. The idle rule is the mobile local PIN/biometric lock, not web/token
expiry. Fuel anomalies mark review, not a capture/shift-close ban.


## Snapshot

`GET /api/v1/field/rules/` returns the values in force, omits future versions, exposes `next_change_at` and carries a `version` hash that is also the `ETag`. The hash is a consistency token; to know what applied at a past instant use the version history.

The version void action takes `{reason_code, reason?}` (#80). The organization's `void-reason`
catalog is resolved before state checks; only `other` requires the #32 text minimum. The
read-only history exposes both `void_reason_code` and `void_reason`.
