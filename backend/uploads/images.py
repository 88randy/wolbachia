"""Decode the same bounded buffer that was hashed; reencode pixels without metadata."""

import hashlib
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from core.exceptions import FieldValidationError
from uploads.limits import JPEG_QUALITY, MAX_IMAGE_PIXELS, MAX_UPLOAD_BYTES, max_upload_bytes


@dataclass(frozen=True)
class SanitizedImage:
    content: bytes
    content_type: str
    width: int
    height: int

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.content).hexdigest()


def _check_image(image: Image.Image, declared: str) -> None:
    if {"JPEG": "image/jpeg", "PNG": "image/png"}.get(image.format or "") != declared:
        raise FieldValidationError("file", "upload_type_mismatch")
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise FieldValidationError("file", "upload_pixel_limit", {"max": MAX_IMAGE_PIXELS})
    if getattr(image, "n_frames", 1) != 1:
        raise FieldValidationError("file", "upload_animation_not_supported")


def sanitize_image(original: bytes, content_type: str) -> SanitizedImage:
    """Only JPEG/PNG, fully decoded, oriented and saved into a metadata-free new image."""
    if len(original) > max_upload_bytes():
        raise FieldValidationError("file", "upload_too_large", {"max_bytes": max_upload_bytes()})
    if original.startswith(b"%PDF-"):
        raise FieldValidationError("file", "upload_content_mismatch")
    try:
        with Image.open(BytesIO(original), formats=["JPEG", "PNG"]) as probe:
            _check_image(probe, content_type)
            probe.verify()
        return _reencode(original, content_type)
    except Image.DecompressionBombError:
        raise FieldValidationError(
            "file", "upload_pixel_limit", {"max": MAX_IMAGE_PIXELS}
        ) from None
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise FieldValidationError("file", "upload_invalid_image") from None


def _reencode(original: bytes, content_type: str) -> SanitizedImage:
    with Image.open(BytesIO(original), formats=["JPEG", "PNG"]) as source:
        source.load()
        oriented = ImageOps.exif_transpose(source)
        # PNG tRNS can carry alpha without an A band (palette or color-key transparency).
        mode = "RGBA" if content_type == "image/png" else "RGB"
        pixels = Image.new(mode, oriented.size)
        pixels.paste(oriented.convert(mode))
        output = BytesIO()
        if content_type == "image/jpeg":
            pixels.save(output, format="JPEG", quality=JPEG_QUALITY)
        else:
            pixels.save(output, format="PNG")
        content = output.getvalue()
        if len(content) > MAX_UPLOAD_BYTES:
            raise FieldValidationError(
                "file", "upload_sanitized_too_large", {"max_bytes": MAX_UPLOAD_BYTES}
            )
        return SanitizedImage(content, content_type, pixels.width, pixels.height)
