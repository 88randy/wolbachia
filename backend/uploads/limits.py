from django.conf import settings

# Hard ceiling, also enforced by the upload_bounded_size SQL check; settings may only lower it.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
UPLOAD_LEASE_SECONDS = 15 * 60
UPLOAD_CHUNK_BYTES = 64 * 1024
JPEG_QUALITY = 90
PDF_CONTENT_TYPE = "application/pdf"
CONTENT_TYPES = ("image/jpeg", "image/png", PDF_CONTENT_TYPE)
FIELD_UPLOAD = "field.upload"


def max_upload_bytes() -> int:
    """Configured per-file limit (UPLOAD_MAX_BYTES, default 10 MiB), never above the SQL ceiling."""
    return min(int(settings.UPLOAD_MAX_BYTES), MAX_UPLOAD_BYTES)
