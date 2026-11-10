"""Type configuration reads preserve the existing capture-list permission."""

from rest_framework.request import Request
from rest_framework.views import APIView

from core.permissions import HasPermissionCode
from incidents.permissions import INCIDENT_MANAGE_TYPE
from organizations.services import effective_scope


class IncidentTypePermission(HasPermissionCode):
    """Configuration managers can read types; legacy report readers retain their list."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        membership = getattr(request, "membership", None)
        if (
            getattr(view, "action", None) == "list"
            and membership is not None
            and effective_scope(membership).allows(INCIDENT_MANAGE_TYPE)
        ):
            return True
        return super().has_permission(request, view)
