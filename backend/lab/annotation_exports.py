"""Immutable selection and job transitions; private storage I/O never holds SQL locks."""

import hashlib
import logging
import tempfile
from collections.abc import Sequence
from datetime import timedelta
from typing import Any, BinaryIO, cast
from uuid import UUID

from django.db import transaction
from django.db.models import Exists, F, OuterRef, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from core.exceptions import FieldValidationError
from core.time import local_day_start
from lab.access import scoped_bags
from lab.exceptions import AnnotationExportNotReadyError
from lab.independent_qa.selectors import blind_visible_counts
from lab.independent_qa.services import (
    NumericPublication,
    numeric_read_transaction,
    publish_numeric_access_batch,
)
from lab.models import (
    EggAnnotation,
    EggAnnotationExport,
    EggAnnotationExportDownload,
    EggAnnotationExportItem,
    EggAnnotationExportStatus,
    EggCountAttempt,
)
from lab.permissions import ANNOTATION_EXPORT
from organizations.models import Membership
from uploads.access import UploadActor, current_scope
from uploads.exceptions import UploadStorageError
from uploads.limits import UPLOAD_CHUNK_BYTES
from uploads.storage import StoredObject

MAX_EXPORT_IMAGES = 5000
EXPORT_POLICY_VERSION = "egg-annotation-export-v1"
logger = logging.getLogger(__name__)


def visible_annotation_rows(actor: UploadActor) -> QuerySet[EggAnnotation]:
    counts = blind_visible_counts(
        actor,
        EggCountAttempt.objects.filter(
            organization=actor.organization, bag__in=scoped_bags(actor, ANNOTATION_EXPORT)
        ),
    )
    return EggAnnotation.objects.filter(organization=actor.organization, count__in=counts)


def export_annotation_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[EggAnnotation]:
    zone = actor.organization.timezone
    rows = visible_annotation_rows(actor).filter(
        created_at__gte=local_day_start(zone, values["date_from"]),
        created_at__lt=local_day_start(zone, values["date_to"] + timedelta(days=1)),
    )
    if values.get("author"):
        rows = rows.filter(created_by_id=values["author"])
    if not values.get("include_voided", False):
        rows = rows.filter(count__void_fact__isnull=True)
    return rows.select_related("count__void_fact").order_by("created_at", "id")


def export_rows(actor: UploadActor) -> QuerySet[EggAnnotationExport]:
    """An archive is indivisible: losing any selected subject hides the entire export."""
    inaccessible = EggAnnotationExportItem.objects.filter(export_id=OuterRef("pk")).exclude(
        annotation__in=visible_annotation_rows(actor)
    )
    return (
        EggAnnotationExport.objects.filter(organization=actor.organization)
        .filter(~Exists(inaccessible))
        .prefetch_related("statuses")
        .order_by("-created_at", "-id")
    )


def export_projection(export: EggAnnotationExport) -> dict[str, Any]:
    state = next(iter(export.statuses.all()))
    return {
        "id": export.pk,
        "created_at": export.created_at,
        "date_from": export.date_from,
        "date_to": export.date_to,
        "author": export.author_id,
        "include_voided": export.include_voided,
        "format": export.format,
        **{
            name: getattr(state, name)
            for name in (
                "status",
                "image_count",
                "box_count",
                "point_count",
                "error_code",
                "size_bytes",
                "sha256",
            )
        },
    }


def append_export_status(export: EggAnnotationExport, status: str, **facts: Any) -> None:  # noqa: ANN401
    EggAnnotationExportStatus.objects.create(
        organization=export.organization,
        export=export,
        status=status,
        revision={"queued": 0, "running": 1, "ready": 2, "failed": 2}[status],
        actor_kind="system",
        policy_version=EXPORT_POLICY_VERSION,
        **facts,
    )


def create_annotation_export(actor: UploadActor, values: dict[str, Any]) -> EggAnnotationExport:
    """Pin selected immutable annotations and their void policy before enqueueing after commit."""
    with numeric_read_transaction(actor):
        if not current_scope(actor).allows(ANNOTATION_EXPORT):
            raise PermissionDenied
        if (
            values.get("author")
            and not Membership.objects.filter(
                organization=actor.organization, user_id=values["author"]
            ).exists()
        ):
            raise FieldValidationError("author", "does_not_exist")
        selected = list(
            export_annotation_rows(actor, values).values_list("pk", "count__void_fact__pk")[
                : MAX_EXPORT_IMAGES + 1
            ]
        )
        if len(selected) > MAX_EXPORT_IMAGES:
            raise FieldValidationError(
                "date_to", "annotation_export_too_many_images", {"max_images": MAX_EXPORT_IMAGES}
            )
        export = EggAnnotationExport.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            **{key: value for key, value in values.items() if key != "author"},
            author_id=values.get("author"),
        )
        EggAnnotationExportItem.objects.bulk_create(
            [
                EggAnnotationExportItem(
                    organization=actor.organization,
                    created_by=actor.user,
                    export=export,
                    annotation_id=annotation_id,
                    voided=void_id is not None,
                )
                for annotation_id, void_id in selected
            ]
        )
        append_export_status(export, "queued")
        transaction.on_commit(lambda: enqueue_annotation_export(str(export.pk)))
    return export


def enqueue_annotation_export(identifier: str) -> None:
    from lab.tasks import build_egg_annotation_export

    try:
        build_egg_annotation_export.delay(identifier)
    except Exception:  # noqa: BLE001 -- preserve the retained request when broker dispatch fails.
        record_export_failure(UUID(identifier))
        logger.exception("Annotation export dispatch failed.", extra={"export_id": identifier})


def claim_annotation_export(identifier: UUID) -> EggAnnotationExport | None:
    with transaction.atomic():
        export = cast(
            EggAnnotationExport,
            (
                EggAnnotationExport.objects.select_for_update(of=("self",))
                .select_related("organization", "created_by")
                .get(pk=identifier)
            ),
        )
        if next(iter(export.statuses.all())).status != "queued":
            return None
        append_export_status(export, "running")
        return export


def require_export_access(actor: UploadActor, identifier: UUID) -> EggAnnotationExport:
    if not current_scope(actor).allows(ANNOTATION_EXPORT):
        raise PermissionDenied
    return get_object_or_404(export_rows(actor), pk=identifier)


def selected_export_annotations(export: EggAnnotationExport) -> QuerySet[EggAnnotation]:
    return cast(
        QuerySet[EggAnnotation],
        (
            EggAnnotation.objects.filter(
                organization=export.organization, export_items__export=export
            )
            .annotate(export_voided=F("export_items__voided"))
            .select_related("image_upload__verification", "count")
            .order_by("created_at", "id")
        ),
    )


def run_annotation_export(identifier: UUID) -> None:
    from lab.annotation_export_archive import build_annotation_archive
    from uploads.storage import store_dataset_export

    export = claim_annotation_export(identifier)
    if export is None:
        return
    try:
        actor = UploadActor(cast(User, export.created_by), export.organization)
        require_export_access(actor, identifier)
        with tempfile.TemporaryFile(mode="w+b") as archive:
            counts = build_annotation_archive(
                export, selected_export_annotations(export).iterator(chunk_size=1), archive
            )
            archive.seek(0)
            stored = store_dataset_export(archive)
        with numeric_read_transaction(actor):
            require_export_access(actor, identifier)
            append_export_status(
                export,
                "ready",
                image_count=counts.image_count,
                box_count=counts.box_count,
                point_count=counts.point_count,
                object_key=stored.key,
                size_bytes=stored.size_bytes,
                sha256=stored.sha256,
            )
    except Exception:  # noqa: BLE001 -- every job failure is an immutable machine-code fact.
        record_export_failure(identifier)
        logger.exception("Annotation export failed.", extra={"export_id": str(identifier)})


def record_export_failure(identifier: UUID) -> None:
    with transaction.atomic():
        export = EggAnnotationExport.objects.select_for_update().get(pk=identifier)
        status = next(iter(export.statuses.all())).status
        if status in {"ready", "failed"}:
            return
        if status == "queued":
            append_export_status(export, "running")
        append_export_status(export, "failed", error_code="annotation_export_failed")


def ready_export(actor: UploadActor, identifier: UUID) -> tuple[EggAnnotationExport, StoredObject]:
    export = require_export_access(actor, identifier)
    state = next(iter(export.statuses.all()))
    if state.status != "ready":
        raise AnnotationExportNotReadyError
    return export, StoredObject(state.object_key, state.size_bytes, state.sha256)


def publish_export_totals(actor: UploadActor, exports: Sequence[EggAnnotationExport]) -> None:
    """Even one-image aggregate totals disclose the original numeric observation."""
    ready_ids = [
        export.pk for export in exports if next(iter(export.statuses.all())).status == "ready"
    ]
    counts = list(
        EggCountAttempt.objects.filter(annotation__export_items__export_id__in=ready_ids)
        .only("id")
        .distinct()
    )
    publish_numeric_access_batch(actor, counts, NumericPublication(ANNOTATION_EXPORT, "result"))


def verify_export_integrity(archive: BinaryIO, receipt: StoredObject) -> None:
    size, digest = 0, hashlib.sha256()
    while chunk := archive.read(UPLOAD_CHUNK_BYTES):
        size += len(chunk)
        digest.update(chunk)
    if size != receipt.size_bytes or digest.hexdigest() != receipt.sha256:
        raise UploadStorageError
    archive.seek(0)


def open_annotation_export(actor: UploadActor, identifier: UUID) -> BinaryIO:
    """Reauthorize before and after unlocked streaming integrity verification; log each delivery."""
    from uploads.storage import open_dataset_export

    with numeric_read_transaction(actor):
        _, receipt = ready_export(actor, identifier)
    archive = open_dataset_export(receipt.key)
    try:
        verify_export_integrity(archive, receipt)
        with numeric_read_transaction(actor):
            export, _ = ready_export(actor, identifier)
            publish_export_totals(actor, [export])
            EggAnnotationExportDownload.objects.create(
                organization=actor.organization, created_by=actor.user, export=export
            )
    except BaseException:
        archive.close()
        raise
    else:
        return archive
