import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.exceptions import ValidationError

COUNTRY_CODE_PATTERN = re.compile(r"^[A-Z]{2}$")
PERMISSION_CODE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$")


def validate_country_code(value: str) -> None:
    """ISO 3166-1 alpha-2 shape (two uppercase letters). [ASSUMPTION] membership in the ISO list
    is not checked yet: it would need a dependency or a vetted data file.
    """
    if not COUNTRY_CODE_PATTERN.fullmatch(value):
        raise ValidationError("Use a two-letter uppercase ISO 3166-1 code.", code="invalid_country")


def validate_timezone(value: str) -> None:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValidationError("Unknown IANA time zone.", code="invalid_timezone") from error


def validate_permission_code(value: str) -> None:
    """Permission codes look like `<resource>.<action>` (e.g. `ovitrap.read`)."""
    if not PERMISSION_CODE_PATTERN.fullmatch(value):
        raise ValidationError("Use the form <resource>.<action>.", code="invalid_permission_code")
