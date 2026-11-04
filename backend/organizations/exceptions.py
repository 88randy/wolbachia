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
