from http import HTTPStatus

from core.exceptions import DomainError


class OtherItemLockedError(DomainError):
    code = "other_item_cannot_be_deactivated"
    status_code = HTTPStatus.CONFLICT
    default_detail = 'The fixed "Other (specify)" item cannot be deactivated.'
