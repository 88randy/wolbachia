"""Structural PDF checks on the same bounded buffer that was hashed. No parsing, no rendering."""

import re

from core.exceptions import FieldValidationError
from uploads.images import SanitizedImage
from uploads.limits import PDF_CONTENT_TYPE, max_upload_bytes

PDF_MAGIC = b"%PDF-"
_TAIL_BYTES = 1024
_XREF_PROBE_BYTES = 4096
_STARTXREF = re.compile(rb"startxref\s+(\d+)\s*%%EOF\s*\Z")
_XREF_TABLE = re.compile(rb"\s*xref")
_XREF_STREAM = re.compile(rb"\s*\d+\s+\d+\s+obj(?:(?!endobj).)*?/Type\s*/XRef", re.DOTALL)
_NAME_ESCAPE = re.compile(rb"#([0-9A-Fa-f]{2})")


def _malformed() -> FieldValidationError:
    return FieldValidationError("file", "upload_invalid_pdf")


def verify_pdf(original: bytes) -> SanitizedImage:
    """Accept only a complete, unencrypted PDF; the bytes are stored unchanged and never inlined.

    Checks: %PDF- header, %%EOF/startxref trailer whose offset lands on an xref table or
    an object with /Type /XRef, and no /Encrypt name anywhere (#xx escapes decoded).
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
    section = original[offset : offset + _XREF_PROBE_BYTES]
    if _XREF_TABLE.match(section) is None and _XREF_STREAM.match(section) is None:
        raise _malformed()
    # Names may hide characters as #xx (/Encr#79pt); scan the whole file, earlier trailers too.
    if b"/Encrypt" in _NAME_ESCAPE.sub(lambda m: bytes([int(m.group(1), 16)]), original):
        raise FieldValidationError("file", "upload_pdf_encrypted")
    return SanitizedImage(original, PDF_CONTENT_TYPE, 0, 0)
