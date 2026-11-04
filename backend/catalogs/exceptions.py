from http import HTTPStatus

from core.exceptions import DomainError


class OtherItemLockedError(DomainError):
    code = "other_item_cannot_be_deactivated"
    status_code = HTTPStatus.CONFLICT
    default_detail = 'The fixed "Other (specify)" item cannot be deactivated.'


class CatalogItemLimitError(DomainError):
    code = "catalog_item_limit_reached"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The catalog already has the maximum number of active items."
