"""Exclusive private files. No overwrite, public URL, user filename or I/O under SQL locks."""

import hashlib
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

from django.conf import settings
from django.db import connection

from core.exceptions import FieldValidationError
from uploads.exceptions import UploadStorageError
from uploads.limits import MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES, max_upload_bytes

KEY_PATTERN = re.compile(r"(?:source|verified)/[0-9a-f]{32}\.bin", re.ASCII)
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StoredObject:
    key: str
    size_bytes: int
    sha256: str


def _private_path(key: str) -> Path:
    if connection.in_atomic_block:
        raise RuntimeError("Private evidence I/O cannot run inside a database transaction.")
    if KEY_PATTERN.fullmatch(key) is None:
        raise ValueError("Invalid private evidence key.")
    root = Path(settings.UPLOADS_PRIVATE_ROOT).resolve()
    target = (root / key).resolve()
    if not target.is_relative_to(root):
        raise ValueError("Private evidence path escaped its root.")
    return target


def store_source(stream: BinaryIO, expected: tuple[int, str]) -> StoredObject:
    """Stream at most the declared limit to a fresh path; incomplete writes never become receipts."""
    key = f"source/{uuid4().hex}.bin"
    target = _private_path(key)
    created = False
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as output:
            created = True
            receipt = _copy_source(stream, output, expected)
        return StoredObject(key, receipt[0], receipt[1])
    except OSError as error:
        if created:
            _discard_path(target)
        raise UploadStorageError from error
    except FieldValidationError:
        if created:
            _discard_path(target)
        raise


def _copy_source(stream: BinaryIO, output: BinaryIO, expected: tuple[int, str]) -> tuple[int, str]:
    size, digest = 0, hashlib.sha256()
    while chunk := stream.read(UPLOAD_CHUNK_BYTES):
        size += len(chunk)
        if size > max_upload_bytes() or size > expected[0]:
            raise FieldValidationError("file", "upload_too_large", {"max_bytes": expected[0]})
        digest.update(chunk)
        output.write(chunk)
    if size != expected[0]:
        raise FieldValidationError("file", "upload_incomplete")
    if digest.hexdigest() != expected[1]:
        raise FieldValidationError("file", "upload_hash_mismatch")
    return size, digest.hexdigest()


def store_verified(content: bytes) -> StoredObject:
    key = f"verified/{uuid4().hex}.bin"
    target = _private_path(key)
    created = False
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as output:
            created = True
            output.write(content)
    except OSError as error:
        if created:
            _discard_path(target)
        raise UploadStorageError from error
    return StoredObject(key, len(content), hashlib.sha256(content).hexdigest())


def discard_candidate(key: str) -> None:
    """Remove only a candidate that cannot be referenced, after every SQL lock is released."""
    _discard_path(_private_path(key))


def _discard_path(target: Path) -> None:
    try:
        target.unlink(missing_ok=True)
    except OSError:
        # No private paths, keys or byte metadata in logs. A failed cleanup never certifies bytes.
        logger.warning("Uncommitted private evidence candidate cleanup failed.")


def read_object(key: str) -> bytes:
    try:
        with _private_path(key).open("rb") as stored:
            content = stored.read(MAX_UPLOAD_BYTES + 1)
    except OSError as error:
        raise UploadStorageError from error
    if len(content) > MAX_UPLOAD_BYTES:
        raise UploadStorageError
    return content
