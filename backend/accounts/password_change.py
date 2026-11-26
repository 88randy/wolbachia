"""A pending password change blocks the API except the views that opt in."""

from rest_framework import exceptions, status
from rest_framework.request import Request

ALLOW_ATTRIBUTE = "allows_pending_password_change"


class PasswordChangeRequiredError(exceptions.APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "password_change_required"
    default_detail = "Choose a new password before continuing."


def enforce_password_change(request: Request, user: object) -> None:
    """Refuse the request while the user still has a temporary password (403)."""
    if not getattr(user, "must_change_password", False):
        return
    view = request.parser_context.get("view") if request.parser_context else None
    if getattr(view, ALLOW_ATTRIBUTE, False):
        return
    raise PasswordChangeRequiredError
