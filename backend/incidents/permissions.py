"""Action codes; each resource check also requires its paired scope grant."""

INCIDENT_READ = "incident.read"
INCIDENT_CREATE = "incident.create"
INCIDENT_CLOSE = "incident.close"
INCIDENT_REASSIGN = "incident.reassign"
INCIDENT_MANAGE_TYPE = "incident.manage_type"
MANAGEMENT_CODES = (
    INCIDENT_READ,
    INCIDENT_CREATE,
    INCIDENT_CLOSE,
    INCIDENT_REASSIGN,
    INCIDENT_MANAGE_TYPE,
)
