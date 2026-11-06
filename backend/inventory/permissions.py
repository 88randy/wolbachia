"""Default grants are explicit data; no action infers another permission."""

SUPPLY_READ = "supply_type.read"
LOCATION_READ = "location.read"
LOT_READ = "lot.read"
CONDITION_CREATE = "condition.create"
READ_CODES = (SUPPLY_READ, LOCATION_READ, LOT_READ)
WAREHOUSE_CODES = (
    *READ_CODES,
    "supply_type.create",
    "supply_type.update",
    "location.create",
    "location.update",
    "lot.create",
    "lot.update",
    CONDITION_CREATE,
)
ADMIN_CODES = (*WAREHOUSE_CODES, "supply_type.deactivate")
SUPERVISOR_CODES = (*READ_CODES, "lot.create", "lot.update", CONDITION_CREATE)
ENTOMOLOGIST_CODES = (*READ_CODES, CONDITION_CREATE)
