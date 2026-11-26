from collections.abc import Mapping

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from organizations.services import effective_scope


class HasPermissionCode(BasePermission):
    """Grant access when the permission code of the current action is in the user's codes.

    A view declares `required_permissions = {"<action>": "<resource>.<action>"}` (viewset actions:
    list, retrieve, create, update, partial_update, plus custom ones such as void). The user's
    codes are the union of the active profiles of the request's membership, which the view must
    resolve first (`OrgScopedViewSetMixin` does). A narrow lookup may instead declare
    `required_any_permissions = {"<action>": (codes...)}`: any one of the codes grants access
    (a narrow code or the broad read code) and the view scopes rows by the union of their grants.
    Fails closed: an action missing from both maps, a view without them, or a request without
    membership is denied.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        action = getattr(view, "action", None) or ""
        required_by_action: Mapping[str, str] = getattr(view, "required_permissions", {})
        any_of: tuple[str, ...] = getattr(view, "required_any_permissions", {}).get(action, ())
        membership = getattr(request, "membership", None)
        if membership is None:
            return False
        scope = effective_scope(membership)
        required = required_by_action.get(action)
        if required is not None:
            return scope.allows(required)
        return any(scope.allows(code) for code in any_of)

    def has_object_permission(self, request: Request, view: APIView, instance: object) -> bool:
        action = getattr(view, "action", "")
        required = getattr(view, "required_permissions", {}).get(action)
        if required is None:
            # Narrow lookups: the view's queryset already scopes by the union of the any-of codes.
            return bool(getattr(view, "required_any_permissions", {}).get(action))
        center = getattr(instance, "center_id", None)
        if getattr(getattr(instance, "_meta", None), "label_lower", "") == "organizations.center":
            center = getattr(instance, "pk", None)
        quadrant = getattr(instance, "quadrant_id", None)
        membership = getattr(request, "membership", None)
        if membership is None:
            return False
        return effective_scope(membership).allows(
            required,
            str(center) if center is not None else None,
            str(quadrant) if quadrant is not None else None,
        )
