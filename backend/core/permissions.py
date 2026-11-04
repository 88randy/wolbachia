from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from organizations.selectors import get_permission_codes


class HasPermissionCode(BasePermission):
    """Grant access when the view's `required_permission` is in the user's permission codes.

    The codes are the union of the active profiles of the request's membership, so the view must
    resolve it first (`OrgScopedViewSetMixin` does). A view without `required_permission`, or a
    request without membership, is denied.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        required = getattr(view, "required_permission", None)
        membership = getattr(request, "membership", None)
        if required is None or membership is None:
            return False
        return required in get_permission_codes(membership)
