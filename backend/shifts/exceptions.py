from http import HTTPStatus

from core.exceptions import DomainError


class MotorcycleInUseError(DomainError):
    code = "motorcycle_in_use"
    status_code = HTTPStatus.CONFLICT
    default_detail = "A motorcycle with an open shift cannot be voided."


class MotorcycleNotBlockedError(DomainError):
    code = "motorcycle_not_blocked"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The motorcycle is not blocked."
