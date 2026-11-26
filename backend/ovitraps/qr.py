"""WE12 identities. A failed scan never silently becomes a manual code."""

import re
from uuid import UUID

QR_PATTERN = re.compile(
    r"wbf:1:(lot|ovitrap|bag|release-device|sample):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
    re.ASCII,
)


def parse_qr(value: str) -> tuple[str, UUID]:
    """Return the kind and canonical UUID; callers explicitly offer manual capture on failure."""
    match = QR_PATTERN.fullmatch(value)
    if match is None or not value.isascii():
        raise ValueError("Invalid QR identity.")
    return match[1], UUID(match[2])


# Labels of things with a stable human code (W19): the payload carries the code, not a UUID.
CODE_QR_PATTERN = re.compile(
    r"wbf:1:(paddle|motorcycle):([A-Za-z0-9][A-Za-z0-9._-]{0,49})", re.ASCII
)


def parse_code_qr(value: str) -> tuple[str, str]:
    """Return the kind and human code of a paddle or motorcycle label."""
    match = CODE_QR_PATTERN.fullmatch(value)
    if match is None:
        raise ValueError("Invalid QR identity.")
    return match[1], match[2]
