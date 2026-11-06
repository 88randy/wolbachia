"""Authored verified database facts for consumer tests which never read stored bytes."""

from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

from uploads.models import AttachmentLink, Upload, UploadLease, UploadSource, UploadVerification


def verified_upload(organization, user, *, device=None, public_id=None, fault=None):
    upload = Upload.objects.create(
        organization=organization,
        created_by=user,
        uploader=user,
        device=device,
        public_id=public_id or uuid4(),
        content_type="image/png",
        size_bytes=1,
        sha256="0" * 64,
    )
    lease = UploadLease.objects.create(
        organization=organization,
        created_by=user,
        upload=upload,
        revision=1,
        expires_at=timezone.now() + timedelta(minutes=15),
    )
    source = UploadSource.objects.create(
        organization=organization,
        created_by=user,
        upload=upload,
        lease=lease,
        object_key=f"source/{uuid4().hex}.bin",
        size_bytes=1,
        sha256="0" * 64,
    )
    UploadVerification.objects.create(
        organization=organization,
        created_by=user,
        upload=upload,
        source=source,
        object_key=f"verified/{uuid4().hex}.bin",
        size_bytes=1,
        sha256="1" * 64,
        content_type="image/png",
        width=1,
        height=1,
    )
    if fault is not None:
        AttachmentLink.objects.create(
            organization=organization,
            created_by=user,
            upload=upload,
            fault=fault,
        )
    return upload
