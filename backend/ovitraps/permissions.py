"""Explicit read permissions; sync writes retain field_event.sync."""

OVITRAP_READ = "ovitrap.read"
READING_READ = "reading.read"
RELOCATION_READ = "relocation.read"
# Registering sticker batches is an inventory write (warehouse, admin, supervisor): there is no
# dedicated label permission, so it reuses the one that lets a profile register lots.
OVITRAP_LABEL_MINT = "lot.create"
OVITRAP_REMOVAL_RESOLVE = "removal.resolve"
READ_CODES = (OVITRAP_READ, READING_READ, RELOCATION_READ)
RELOCATION_DECIDE = "relocation.decide"
