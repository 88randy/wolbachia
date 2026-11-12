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
    resolve first (`OrgScopedViewSetMixin` does). Fails closed: an action missing from the map,
    a view without the map, or a request without membership is denied.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        required_by_action: Mapping[str, str] = getattr(view, "required_permissions", {})
        required = required_by_action.get(getattr(view, "action", None) or "")
        membership = getattr(request, "membership", None)
        if required is None or membership is None:
            return False
        return effective_scope(membership).allows(required)

    def has_object_permission(self, request: Request, view: APIView, instance: object) -> bool:
        required = getattr(view, "required_permissions", {}).get(getattr(view, "action", ""))
        if required is None:
            return False
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


class HasAnyPermissionCode(BasePermission):
    """Grant access when ANY code of `required_any_permissions[action]` is held.

    For narrow lookups (names and codes) that a narrow code or the broad read code both unlock.
    Scoping stays the view's job: it filters by the union of the grants of those codes.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        required_by_action: Mapping[str, tuple[str, ...]] = getattr(
            view, "required_any_permissions", {}
        )
        codes = required_by_action.get(getattr(view, "action", None) or "", ())
        membership = getattr(request, "membership", None)
        if not codes or membership is None:
            return False
        scope = effective_scope(membership)
        return any(scope.allows(code) for code in codes)
