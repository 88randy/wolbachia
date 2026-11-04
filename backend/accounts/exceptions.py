from http import HTTPStatus

from core.exceptions import DomainError


class InvalidCredentialsError(DomainError):
    """Bad password, unknown user or inactive user: one generic answer for all three."""

    code = "invalid_credentials"
    status_code = HTTPStatus.UNAUTHORIZED
    default_detail = "The credentials are not valid."


class InvalidTokenError(DomainError):
    code = "invalid_token"
    status_code = HTTPStatus.UNAUTHORIZED
    default_detail = "The token is not valid."


class TokenExpiredError(DomainError):
    code = "token_expired"
    status_code = HTTPStatus.UNAUTHORIZED
    default_detail = "The token has expired."


class SessionRevokedError(DomainError):
    code = "session_revoked"
    status_code = HTTPStatus.UNAUTHORIZED
    default_detail = "The session was revoked."


class DeviceRevokedError(DomainError):
    code = "device_revoked"
    status_code = HTTPStatus.FORBIDDEN
    default_detail = "The device was revoked."


class DeviceOrganizationMismatchError(DomainError):
    code = "device_organization_mismatch"
    status_code = HTTPStatus.FORBIDDEN
    default_detail = "The device is registered in another organization."


class InvalidResetTokenError(DomainError):
    code = "invalid_reset_token"
    status_code = HTTPStatus.BAD_REQUEST
    default_detail = "The password reset link is not valid or has expired."
