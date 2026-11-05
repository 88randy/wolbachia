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


class ProtectedOtherItemError(OtherItemLockedError):
    code = "other_item_protected"
    default_detail = 'The fixed "Other (specify)" item cannot be edited.'
    blocked_by = [
        {"reason": "protected_other_item", "unblocked_by_role": "admin", "link": "/catalogs/"}
    ]


class CatalogVersionConflictError(DomainError):
    code = "catalog_version_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The catalog changed since this reorder was planned."
