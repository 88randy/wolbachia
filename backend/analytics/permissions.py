"""Read-only dashboard permission codes (one per dashboard, scoped by the grant work scope)."""

OPERATIONS_READ = "analytics.operations.read"
ENTOMOLOGY_READ = "analytics.entomology.read"
WOLBACHIA_READ = "analytics.wolbachia.read"

SUPERVISOR_CODES = (OPERATIONS_READ, ENTOMOLOGY_READ)
COORDINATOR_CODES = (OPERATIONS_READ, ENTOMOLOGY_READ, WOLBACHIA_READ)
ENTOMOLOGIST_CODES = (ENTOMOLOGY_READ, WOLBACHIA_READ)
ADMIN_CODES = (OPERATIONS_READ, ENTOMOLOGY_READ, WOLBACHIA_READ)
