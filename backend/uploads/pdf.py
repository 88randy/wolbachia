"""Structural PDF checks on the same bounded buffer that was hashed. No parsing, no rendering."""

import re

from core.exceptions import FieldValidationError
from uploads.images import SanitizedImage
from uploads.limits import PDF_CONTENT_TYPE, max_upload_bytes

PDF_MAGIC = b"%PDF-"
_TAIL_BYTES = 1024
_STARTXREF = re.compile(rb"startxref\s+(\d+)\s*%%EOF\s*\Z")
_XREF_SECTION = re.compile(rb"\s*(?:xref|\d+\s+\d+\s+obj)")


def _malformed() -> FieldValidationError:
    return FieldValidationError("file", "upload_invalid_pdf")


def verify_pdf(original: bytes) -> SanitizedImage:
    """Accept only a complete, unencrypted PDF; the bytes are stored unchanged and never inlined.

    Checks: %PDF- header, %%EOF/startxref trailer whose offset reaches a cross-reference
    section, and no /Encrypt entry in the final trailer or xref-stream dictionary.
    """
    if len(original) > max_upload_bytes():
        raise FieldValidationError("file", "upload_too_large", {"max_bytes": max_upload_bytes()})
    if not original.startswith(PDF_MAGIC):
        raise FieldValidationError("file", "upload_content_mismatch")
    found = _STARTXREF.search(original[-_TAIL_BYTES:])
    if found is None:
        raise _malformed()
    offset = int(found.group(1))
    if offset >= len(original):
        raise _malformed()
    section = original[offset:]
    if _XREF_SECTION.match(section) is None:
        raise _malformed()
    if b"/Encrypt" in section:
        raise FieldValidationError("file", "upload_pdf_encrypted")
    return SanitizedImage(original, PDF_CONTENT_TYPE, 0, 0)
