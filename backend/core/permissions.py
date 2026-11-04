from collections.abc import Mapping

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from organizations.selectors import get_permission_codes


class HasPermissionCode(BasePermission):
    """Grant access when the permission code of the current action is in the user's codes.

    A view declares `required_permissions = {"<action>": "<resource>.<action>"}` (viewset actions:
    list, retrieve, create, update, partial_update, plus custom ones such as void). The user's
    codes are the union of the active profiles of the request's membership, which the view must
    resolve first (`OrgScopedViewSetMixin` does). Fails closed: an action missing from the map,
    a view without the map, or a request without membership is denied.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        required_by_action: Mapping[str, str] = getattr(view, "required_permissions", {})
        required = required_by_action.get(getattr(view, "action", None) or "")
        membership = getattr(request, "membership", None)
        if required is None or membership is None:
            return False
        return required in get_permission_codes(membership)
