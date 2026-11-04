"""Event types and result codes of the shift lifecycle (documented in docs/sync.md).

The phone translates each code with `packages/i18n` (`sync.result.*`); the API returns codes and
params, never user-facing text.
"""

SHIFT_OPEN_EVENT_TYPE = "shift.open"
SHIFT_CLOSE_EVENT_TYPE = "shift.close"
MOTORCYCLE_CHECK_CATALOG_SLUG = "motorcycle-check-item"

# `rejected`
SHIFT_ALREADY_OPEN = "shift_already_open"
MOTORCYCLE_UNKNOWN = "motorcycle_unknown"
MOTORCYCLE_BLOCKED = "motorcycle_blocked"
ODOMETER_OUT_OF_RANGE = "odometer_out_of_range"
SHIFT_NOT_OPEN = "shift_not_open"
MOTORCYCLE_IN_USE = "motorcycle_in_use"
SHIFT_EVENT_NOT_VOIDABLE = "shift_event_not_voidable"

# `in_review`
CAPTURED_AFTER_SHIFT_CLOSE = "captured_after_shift_close"
ODOMETER_DECREASED = "odometer_decreased"
SEVERE_CHECK = "severe_check"

OPEN_CODES = (
    SHIFT_ALREADY_OPEN,
    MOTORCYCLE_UNKNOWN,
    MOTORCYCLE_BLOCKED,
    MOTORCYCLE_IN_USE,
    ODOMETER_OUT_OF_RANGE,
    ODOMETER_DECREASED,
    SEVERE_CHECK,
    SHIFT_EVENT_NOT_VOIDABLE,
)
CLOSE_CODES = (
    SHIFT_NOT_OPEN,
    CAPTURED_AFTER_SHIFT_CLOSE,
    ODOMETER_OUT_OF_RANGE,
    ODOMETER_DECREASED,
    SHIFT_EVENT_NOT_VOIDABLE,
)
