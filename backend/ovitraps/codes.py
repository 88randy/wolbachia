"""Stable per-event result codes, documented and translated."""

POINT_INACCESSIBLE = "ovitrap_point_inaccessible"
OVITRAP_INACCESSIBLE = "ovitrap_inaccessible"
IDENTITY_USED = "ovitrap_identity_used"
POINT_OCCUPIED = "ovitrap_point_occupied"
READING_EXISTS = "ovitrap_reading_exists"
BAG_CODE_USED = "ovitrap_bag_code_used"
CATALOG_UNKNOWN = "ovitrap_catalog_item_unknown"
CATALOG_VERSION_UNAVAILABLE = "ovitrap_catalog_version_unavailable"
CATALOG_DEACTIVATED = "ovitrap_catalog_item_deactivated"
GPS_UNUSABLE = "ovitrap_gps_unusable"
RULES_UNAVAILABLE = "ovitrap_rules_unavailable"
POINT_UNAVAILABLE = "ovitrap_point_version_unavailable"
TOO_FAR = "ovitrap_too_far"
SPEED_ANOMALY = "ovitrap_speed_anomaly"
VOID_BLOCKED = "ovitrap_void_blocked"
STALE_IDENTITY = "ovitrap_stale_identity"
EVIDENCE_REQUIRED = "ovitrap_evidence_required"
LATE_WORK_AFTER_CLOSE = "late_work_after_quadrant_close"
CAPTURED_AFTER_CLOSE = "captured_after_quadrant_close"
CODES = (
    LATE_WORK_AFTER_CLOSE,
    CAPTURED_AFTER_CLOSE,
    STALE_IDENTITY,
    EVIDENCE_REQUIRED,
    POINT_INACCESSIBLE,
    OVITRAP_INACCESSIBLE,
    IDENTITY_USED,
    POINT_OCCUPIED,
    READING_EXISTS,
    BAG_CODE_USED,
    CATALOG_UNKNOWN,
    CATALOG_DEACTIVATED,
    CATALOG_VERSION_UNAVAILABLE,
    GPS_UNUSABLE,
    RULES_UNAVAILABLE,
    POINT_UNAVAILABLE,
    TOO_FAR,
    SPEED_ANOMALY,
    VOID_BLOCKED,
)
