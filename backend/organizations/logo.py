"""Restricted PNG validation and metadata stripping without external storage or dependencies.

[ASSUMPTION] Until a maintained image sanitizer is approved, accept only noninterlaced
8-bit RGB/RGBA PNGs. This is a strict raster validator, not a general image decoder.
"""

import struct
import zlib

from django.core.files.uploadedfile import UploadedFile

from core.exceptions import FieldValidationError

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_LOGO_BYTES = 1024 * 1024
MAX_LOGO_DIMENSION = 1024
PNG_HEADER_LENGTH = 13
PNG_CHUNK_OVERHEAD = 12
ALLOWED_COLOR_CHANNELS = {2: 3, 6: 4}


def _chunk(kind: bytes, content: bytes) -> bytes:
    return (
        struct.pack(">I", len(content))
        + kind
        + content
        + struct.pack(">I", zlib.crc32(kind + content))
    )


def _read_chunks(content: bytes) -> list[tuple[bytes, bytes]]:
    offset = len(PNG_SIGNATURE)
    chunks = []
    while offset < len(content):
        if offset + PNG_CHUNK_OVERHEAD > len(content):
            raise ValueError("Truncated PNG.")
        length = struct.unpack(">I", content[offset : offset + 4])[0]
        kind = content[offset + 4 : offset + 8]
        end = offset + 8 + length
        if (
            end + 4 > len(content)
            or zlib.crc32(kind + content[offset + 8 : end])
            != struct.unpack(">I", content[end : end + 4])[0]
        ):
            raise ValueError("Invalid PNG chunk.")
        chunks.append((kind, content[offset + 8 : end]))
        offset = end + 4
    return chunks


def _validate_pixels(header: bytes, compressed: bytes) -> None:
    if len(header) != PNG_HEADER_LENGTH:
        raise ValueError("Invalid PNG header.")
    width, height, depth, color, compression, filtering, interlace = struct.unpack(
        ">IIBBBBB", header
    )
    if not (0 < width <= MAX_LOGO_DIMENSION and 0 < height <= MAX_LOGO_DIMENSION):
        raise ValueError("PNG dimensions out of range.")
    if depth != 8 or color not in ALLOWED_COLOR_CHANNELS or compression or filtering or interlace:
        raise ValueError("Only noninterlaced 8-bit RGB/RGBA PNG is supported.")
    row_size = width * ALLOWED_COLOR_CHANNELS[color] + 1
    expected = row_size * height
    decoder = zlib.decompressobj()
    pixels = decoder.decompress(compressed, expected + 1)
    if len(pixels) != expected or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
        raise ValueError("Invalid or oversized PNG pixel stream.")
    if any(pixels[offset] > 4 for offset in range(0, expected, row_size)):
        raise ValueError("Invalid PNG row filter.")


def validate_logo(upload: UploadedFile) -> bytes:
    """Reject MIME/signature/size mismatches; strip all optional metadata and trailing data."""
    if upload.content_type != "image/png" or upload.size is None or upload.size > MAX_LOGO_BYTES:
        raise FieldValidationError("logo", "invalid_raster_logo")
    content = upload.read(MAX_LOGO_BYTES + 1)
    try:
        return _validated_png(content)
    except (ValueError, struct.error, zlib.error) as error:
        raise FieldValidationError("logo", "invalid_raster_logo") from error


def _validated_png(content: bytes) -> bytes:
    if len(content) > MAX_LOGO_BYTES or not content.startswith(PNG_SIGNATURE):
        raise ValueError("Invalid PNG signature or size.")
    chunks = _read_chunks(content)
    if not chunks or chunks[0][0] != b"IHDR" or chunks[-1] != (b"IEND", b""):
        raise ValueError("Missing PNG boundaries.")
    if (
        sum(kind == b"IHDR" for kind, _ in chunks) != 1
        or sum(kind == b"IEND" for kind, _ in chunks) != 1
    ):
        raise ValueError("Repeated PNG boundaries.")
    if any(kind not in (b"IHDR", b"IDAT", b"IEND") and not kind[0] & 32 for kind, _ in chunks):
        raise ValueError("Unsupported critical PNG chunk.")
    compressed = b"".join(payload for kind, payload in chunks if kind == b"IDAT")
    _validate_pixels(chunks[0][1], compressed)
    return (
        PNG_SIGNATURE
        + _chunk(b"IHDR", chunks[0][1])
        + _chunk(b"IDAT", compressed)
        + _chunk(b"IEND", b"")
    )
