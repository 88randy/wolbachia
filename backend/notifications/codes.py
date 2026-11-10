"""Closed message catalog: params carry typed technical values, never prose."""

from uuid import UUID

from core.exceptions import FieldValidationError

CODE_KINDS = {
    "incident.created": "incident",
    "incident.comment": "incident",
    "incident.reassigned": "incident",
    "incident.severity_changed": "incident",
    "incident.closed": "incident",
    "incident.escalated": "incident",
    "incident.critical_source": "critical",
    "incident.critical_review": "critical",
    "incident.severe_fault": "critical",
    "training.certification_expired": "training",
    "training.third_adverse": "training",
    "notification.system": "system",
}
PARAMS_BY_CODE = {
    **{
        code: {"incident_id", "event_id", "revision"}
        for code in CODE_KINDS
        if CODE_KINDS[code] == "incident"
    },
    "incident.critical_source": {"event_id"},
    "incident.critical_review": {"review_item_id", "event_id"},
    "incident.severe_fault": {"fault_id"},
    "training.certification_expired": {"certification_id"},
    "training.third_adverse": {"evaluation_id"},
    "notification.system": set(),
}


def validate_message(code: str, params: dict[str, object]) -> str:
    """Reject unregistered codes/keys and nontechnical values before publication."""
    if code not in CODE_KINDS:
        raise FieldValidationError("code", "unknown_code")
    if set(params) - PARAMS_BY_CODE[code]:
        raise FieldValidationError("params", "unknown_param")
    for key, value in params.items():
        if key == "revision":
            if type(value) is not int or value < 1:
                raise FieldValidationError("params", "invalid_param")
        elif not _is_uuid(value):
            raise FieldValidationError("params", "invalid_param")
    return CODE_KINDS[code]


def _is_uuid(value: object) -> bool:
    try:
        return isinstance(value, str) and str(UUID(value)) == value
    except ValueError:
        return False
