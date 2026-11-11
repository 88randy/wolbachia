from http import HTTPStatus

from core.exceptions import DomainError


class NoActiveMembershipError(DomainError):
    code = "no_active_membership"
    status_code = HTTPStatus.FORBIDDEN
    default_detail = "The user has no active membership in the requested organization."


class OrganizationHeaderRequiredError(DomainError):
    code = "organization_header_required"
    status_code = HTTPStatus.BAD_REQUEST
    default_detail = "The X-Organization header is required for users with several memberships."


class ProfileOrganizationMismatchError(DomainError):
    code = "profile_organization_mismatch"
    status_code = HTTPStatus.BAD_REQUEST
    default_detail = "A profile belongs to a different organization than the membership."


class AdminUserConflictError(DomainError):
    code = "admin_user_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "A user with that username exists with a different email."


class LastAdministratorError(DomainError):
    code = "last_administrator"
    status_code = HTTPStatus.CONFLICT
    default_detail = "At least one active administrator must remain."
    blocked_by = [
        {"reason": "last_administrator", "unblocked_by_role": "admin", "link": "/memberships/"}
    ]


class OwnAdministrationError(DomainError):
    code = "own_administration"
    status_code = HTTPStatus.CONFLICT
    default_detail = "You cannot remove your own administration rights."
    blocked_by = [
        {"reason": "own_administration", "unblocked_by_role": "admin", "link": "/memberships/"}
    ]


class StaleRevisionError(DomainError):
    code = "stale_revision"
    status_code = HTTPStatus.CONFLICT
    default_detail = "Reload the current revision before making this change."
    blocked_by = [{"reason": "stale_revision", "unblocked_by_role": "admin", "link": ""}]


class AdministrationBusyError(DomainError):
    code = "administration_in_progress"
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_detail = "Another organization administration transaction is in progress. Retry."

    def response_headers(self) -> dict[str, str]:
        return {"Retry-After": "1"}


class GovernmentPermissionError(DomainError):
    code = "government_portal_only"
    status_code = HTTPStatus.CONFLICT
    default_detail = "Government is restricted to read-only portal permissions."

    blocked_by = [
        {"reason": "government_portal_only", "unblocked_by_role": "admin", "link": "/roles/"}
    ]
