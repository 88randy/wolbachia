"""Separate operator, own-courier and whole-Bag actions; never role authorization."""

ALLOCATE = "inventory.allocate"
RECONCILE = "inventory.reconcile"
WRITE_OFF = "inventory.write_off"
RECEIVE_OWN = "supply_assignment.receive"
RECONCILE_OWN = "supply_assignment.reconcile"
BAG_DISPOSE = "bag.dispose"

OPERATOR_CODES = (ALLOCATE, RECONCILE, WRITE_OFF)
COURIER_CODES = (RECEIVE_OWN, RECONCILE_OWN)
ADMIN_CODES = (*OPERATOR_CODES, *COURIER_CODES, BAG_DISPOSE)
SOURCE_PERMISSIONS = {"supplies.receive": RECEIVE_OWN, "supplies.reconcile": RECONCILE_OWN}
INTENT_KINDS = (
    "assignment_release",
    "release_cancel",
    "return_accept",
    "reconcile_justify",
    "lot_write_off",
    "bag_disposal",
)
