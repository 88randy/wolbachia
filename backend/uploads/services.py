"""Short identity -> Upload commits around unlocked private file I/O; no domain lock inversions."""

import hashlib
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, BinaryIO, cast
from uuid import UUID, uuid4

from django.core import signing
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Q
from django.http import Http404

from core.exceptions import FieldValidationError
from core.time import server_now
from field_sync.services import (
    RETRYABLE_SQLSTATES,
    check_deferred_constraints_now,
    set_batch_lock_timeout,
)
from uploads.access import UploadActor, lock_actor, require_upload_permission
from uploads.exceptions import UploadConflictError, UploadInProgressError, UploadStorageError
from uploads.images import sanitize_image
from uploads.limits import UPLOAD_LEASE_SECONDS
from uploads.models import AttachmentLink, Upload, UploadLease, UploadSource, UploadVerification
from uploads.storage import discard_candidate, read_object, store_source, store_verified
from uploads.targets import AttachmentTarget, authorize_download, authorize_target

LEASE_HEADER = "Upload-Lease"
LEASE_SIGNING_SALT = "uploads.private.put.v1"


@dataclass(frozen=True)
class UploadRequest:
    content_type: str
    size_bytes: int
    sha256: str
    client_id: UUID | None = None
    context: AttachmentTarget | None = None


@contextmanager
def identity_transaction(actor: UploadActor) -> Iterator[None]:
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            lock_actor(actor)
            yield
            check_deferred_constraints_now()
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise UploadInProgressError from error
        raise


@contextmanager
def actor_transaction(actor: UploadActor) -> Iterator[None]:
    with identity_transaction(actor):
        require_upload_permission(actor)
        yield


def owned_upload(actor: UploadActor, identifier: UUID) -> Upload:
    require_upload_permission(actor)
    upload = (
        Upload.objects.filter(
            organization=actor.organization,
            public_id=identifier,
            uploader=actor.user,
        )
        .filter(Q(device__isnull=True) if actor.device_id is None else Q(device_id=actor.device_id))
        .first()
    )
    if upload is None:
        raise Http404
    return cast(Upload, upload)


@contextmanager
def upload_transaction(actor: UploadActor, identifier: UUID) -> Iterator[Upload]:
    original = owned_upload(actor, identifier)
    _authorize_existing_link(actor, original)
    with actor_transaction(actor):
        upload = Upload.objects.select_for_update(nowait=True, no_key=True).get(pk=original.pk)
        _authorize_existing_link(actor, upload)
        yield upload


def _authorize_existing_link(actor: UploadActor, upload: Upload) -> None:
    if link := AttachmentLink.objects.filter(upload=upload).first():
        authorize_target(actor, _resolve_link_target(link), upload)


def _resolve_link_target(link: AttachmentLink) -> AttachmentTarget:
    """Resolve the one actual parent; never infer a kind from a missing identifier."""
    identifiers = (
        ("field_event", link.field_event_id),
        ("motorcycle_fault", link.fault_id),
        ("incident", link.incident_id),
        ("review_item", link.review_item_id),
        ("transfer_event", getattr(link, "transfer_event_id", None)),
    )
    targets = [
        AttachmentTarget(kind, identifier)
        for kind, identifier in identifiers
        if identifier is not None
    ]
    if len(targets) != 1:
        raise Http404
    return targets[0]


def _bind(actor: UploadActor, upload: Upload, target: AttachmentTarget | None) -> None:
    if target is None:
        return
    parent = authorize_target(actor, target, upload)
    existing, _created = AttachmentLink.objects.get_or_create(
        upload=upload,
        defaults={"organization": actor.organization, "created_by": actor.user, **parent},
    )
    if _resolve_link_target(existing) != target:
        raise UploadConflictError("upload_already_bound")


def _append_lease(actor: UploadActor, upload: Upload) -> UploadLease:
    previous = UploadLease.objects.filter(upload=upload).order_by("-revision").first()
    return UploadLease.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        upload=upload,
        revision=1 if previous is None else previous.revision + 1,
        expires_at=server_now() + timedelta(seconds=UPLOAD_LEASE_SECONDS),
    )


def _lease_response(upload: Upload, lease: UploadLease) -> dict[str, Any]:
    ticket = signing.Signer(salt=LEASE_SIGNING_SALT).sign(str(lease.pk))
    return {
        "upload_id": str(upload.public_id),
        "url": f"/api/v1/field/uploads/{upload.public_id}/content/",
        "method": "PUT",
        "headers": {LEASE_HEADER: ticket, "Content-Type": upload.content_type},
        "expires_at": lease.expires_at,
    }


def authorize_upload(actor: UploadActor, request: UploadRequest) -> dict[str, Any]:
    identifier = request.client_id or uuid4()
    require_upload_permission(actor)
    existing = Upload.objects.filter(organization=actor.organization, public_id=identifier).first()
    if existing is not None:
        _check_metadata(actor, existing, request)
        _authorize_existing_link(actor, existing)
    if request.context is not None:
        candidate = Upload(
            organization=actor.organization,
            public_id=identifier,
            uploader=actor.user,
            device_id=actor.device_id,
        )
        authorize_target(actor, request.context, candidate)
    with actor_transaction(actor):
        upload = (
            Upload.objects.select_for_update(nowait=True, no_key=True)
            .filter(organization=actor.organization, public_id=identifier)
            .first()
        )
        if upload is None:
            upload = _insert_upload(actor, request, identifier)
        _check_metadata(actor, upload, request)
        _bind(actor, upload, request.context)
        lease = UploadLease.objects.filter(upload=upload).order_by("-revision").first()
        if lease is None or lease.expires_at <= server_now():
            lease = _append_lease(actor, upload)
        return _lease_response(upload, lease)


def _insert_upload(actor: UploadActor, request: UploadRequest, identifier: UUID) -> Upload:
    try:
        with transaction.atomic():
            return Upload.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                uploader=actor.user,
                device_id=actor.device_id,
                public_id=identifier,
                content_type=request.content_type,
                size_bytes=request.size_bytes,
                sha256=request.sha256,
            )
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", "")
            != "upload_org_public_id"
        ):
            raise
        existing = Upload.objects.get(organization=actor.organization, public_id=identifier)
        _check_metadata(actor, existing, request)
        return cast(
            Upload, Upload.objects.select_for_update(nowait=True, no_key=True).get(pk=existing.pk)
        )


def _check_metadata(actor: UploadActor, upload: Upload, request: UploadRequest) -> None:
    if upload.uploader_id != actor.user.pk or upload.device_id != actor.device_id:
        raise Http404
    if (upload.content_type, upload.size_bytes, upload.sha256) != (
        request.content_type,
        request.size_bytes,
        request.sha256,
    ):
        raise UploadConflictError("upload_identity_conflict")


def upload_state(upload: Upload) -> dict[str, Any]:
    verified = UploadVerification.objects.filter(upload=upload).first()
    state = (
        "verified"
        if verified
        else ("received" if UploadSource.objects.filter(upload=upload).exists() else "authorized")
    )
    return {
        "id": str(upload.public_id),
        "state": state,
        "verified_at": None if verified is None else verified.created_at,
    }


def renew_upload(actor: UploadActor, identifier: UUID) -> dict[str, Any]:
    with upload_transaction(actor, identifier) as upload:
        return {**upload_state(upload), **_lease_response(upload, _append_lease(actor, upload))}


def _usable_lease(upload: Upload, ticket: str) -> UploadLease:
    try:
        identifier = UUID(signing.Signer(salt=LEASE_SIGNING_SALT).unsign(ticket))
    except (signing.BadSignature, ValueError, TypeError):
        raise UploadConflictError("upload_lease_invalid") from None
    lease = UploadLease.objects.filter(upload=upload).order_by("-revision").first()
    if lease is None or lease.pk != identifier or lease.expires_at <= server_now():
        raise UploadConflictError("upload_lease_expired")
    return cast(UploadLease, lease)


@dataclass(frozen=True)
class UploadBody:
    identifier: UUID
    ticket: str
    stream: BinaryIO


def receive_upload(actor: UploadActor, body: UploadBody) -> None:
    with upload_transaction(actor, body.identifier) as upload:
        lease = _usable_lease(upload, body.ticket)
        if UploadSource.objects.filter(upload=upload).exists():
            return
        expected = (upload.size_bytes, upload.sha256)
    candidate = store_source(body.stream, expected)
    retained = False
    try:
        with upload_transaction(actor, body.identifier) as upload:
            current = _usable_lease(upload, body.ticket)
            if current.pk != lease.pk:
                raise UploadConflictError("upload_lease_expired")
            source = UploadSource.objects.filter(upload=upload).first()
            if source is None:
                source = UploadSource.objects.create(
                    organization=actor.organization,
                    created_by=actor.user,
                    upload=upload,
                    lease=current,
                    object_key=candidate.key,
                    size_bytes=candidate.size_bytes,
                    sha256=candidate.sha256,
                )
            # COMMIT can persist while its acknowledgement is lost. Never delete a possible fact.
            retained = source.object_key == candidate.key
    finally:
        if not retained:
            discard_candidate(candidate.key)


def finalize_upload(
    actor: UploadActor, identifier: UUID, target: AttachmentTarget | None = None
) -> dict[str, Any]:
    if target is not None:
        authorize_target(actor, target, owned_upload(actor, identifier))
    with upload_transaction(actor, identifier) as upload:
        _bind(actor, upload, target)
        if UploadVerification.objects.filter(upload=upload).exists():
            return upload_state(upload)
        source = UploadSource.objects.filter(upload=upload).first()
        if source is None:
            raise UploadConflictError("upload_incomplete")
    original = read_object(source.object_key)
    if len(original) != source.size_bytes or hashlib.sha256(original).hexdigest() != source.sha256:
        raise FieldValidationError("file", "upload_hash_mismatch")
    cleaned = sanitize_image(original, upload.content_type)
    candidate = store_verified(cleaned.content)
    retained = False
    try:
        with upload_transaction(actor, identifier) as upload:
            _bind(actor, upload, target)
            verification = UploadVerification.objects.filter(upload=upload).first()
            if verification is None:
                verification = UploadVerification.objects.create(
                    organization=actor.organization,
                    created_by=actor.user,
                    upload=upload,
                    source=source,
                    object_key=candidate.key,
                    size_bytes=candidate.size_bytes,
                    sha256=candidate.sha256,
                    content_type=cleaned.content_type,
                    width=cleaned.width,
                    height=cleaned.height,
                )
            retained = verification.object_key == candidate.key
            return upload_state(upload)
    finally:
        if not retained:
            discard_candidate(candidate.key)


def download_attachment(actor: UploadActor, identifier: UUID) -> tuple[bytes, str]:
    upload = Upload.objects.filter(organization=actor.organization, public_id=identifier).first()
    if upload is None:
        raise Http404
    link = AttachmentLink.objects.filter(upload=upload).first()
    verified = UploadVerification.objects.filter(upload=upload).first()
    if link is None or verified is None:
        raise Http404
    with identity_transaction(actor):
        authorize_download(actor, link)
    content = read_object(verified.object_key)
    if (
        len(content) != verified.size_bytes
        or hashlib.sha256(content).hexdigest() != verified.sha256
    ):
        raise UploadStorageError
    # Reads certify no capability: a late scope loss must be checked again before returning bytes.
    with identity_transaction(actor):
        authorize_download(actor, link)
    return content, verified.content_type
