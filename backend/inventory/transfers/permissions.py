"""Explicit once-only grants; custody never implies sync/bootstrap or another action."""

TRANSFER_READ = "transfer.read"
TRANSFER_CREATE = "transfer.create"
TRANSFER_DISPATCH = "transfer.dispatch"
TRANSFER_RECEIVE = "transfer.receive"
DISCREPANCY_READ = "discrepancy.read"
DISCREPANCY_CLOSE = "discrepancy.close"
WAREHOUSE_CODES = (
    TRANSFER_READ,
    TRANSFER_CREATE,
    TRANSFER_DISPATCH,
    TRANSFER_RECEIVE,
    DISCREPANCY_READ,
)
ADMIN_CODES = (*WAREHOUSE_CODES, DISCREPANCY_CLOSE)
SUPERVISOR_CODES = (TRANSFER_READ, TRANSFER_RECEIVE, DISCREPANCY_READ, DISCREPANCY_CLOSE)
