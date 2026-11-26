"""Immutable selection and job transitions; private storage I/O never holds SQL locks."""

import hashlib
import logging
import os
import tempfile
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, BinaryIO, cast
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.db.models import Exists, F, OuterRef, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from accounts.exceptions import SessionRevokedError
from accounts.models import User
from core.exceptions import FieldValidationError
from core.time import local_day_start, server_now
from lab.access import scoped_bags
from lab.exceptions import (
    AnnotationExportExpiredError,
    AnnotationExportInProgressError,
    AnnotationExportNotReadyError,
)
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
    LabNumericDisclosure,
)
from lab.permissions import ANNOTATION_EXPORT
from organizations.models import Membership
from organizations.services import memoize_effective_scope
from uploads.access import UploadActor, current_scope
from uploads.exceptions import UploadStorageError
from uploads.limits import UPLOAD_CHUNK_BYTES
from uploads.storage import StoredObject

if TYPE_CHECKING:
    from lab.annotation_export_archive import ExportCounts

MAX_EXPORT_IMAGES = 5000
MAX_EXPORT_BYTES = 2 * 1024**3
EXPORT_TIME_LIMIT_SECONDS = 1860
EXPORT_RECOVERY_MARGIN_SECONDS = 120
EXPORT_POLICY_VERSION = "egg-annotation-export-v2"
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
    # Requesting a training export explicitly discloses its sealed counts to the requester.
    rows = EggAnnotation.objects.filter(
        organization=actor.organization,
        count__bag__in=scoped_bags(actor, ANNOTATION_EXPORT),
        created_at__gte=local_day_start(zone, values["date_from"]),
        created_at__lt=local_day_start(zone, values["date_to"] + timedelta(days=1)),
    )
    if values.get("author"):
        rows = rows.filter(created_by_id=values["author"])
    if not values.get("include_voided", False):
        rows = rows.filter(count__void_fact__isnull=True)
    return rows.order_by("created_at", "id")


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
        revision={"queued": 0, "running": 1, "ready": 2, "failed": 2, "expired": 3}[status],
        actor_kind="system",
        policy_version=EXPORT_POLICY_VERSION,
        **facts,
    )


def create_annotation_export(actor: UploadActor, values: dict[str, Any]) -> EggAnnotationExport:
    """Seal selection and requester disclosures atomically, before enqueueing after commit."""
    with numeric_read_transaction(actor):
        if not current_scope(actor).allows(ANNOTATION_EXPORT):
            raise PermissionDenied
        require_export_capacity(actor)
        if (
            values.get("author")
            and not Membership.objects.filter(
                organization=actor.organization, user_id=values["author"]
            ).exists()
        ):
            raise FieldValidationError("author", "does_not_exist")
        selected = list(
            export_annotation_rows(actor, values).values_list(
                "pk", "count_id", "count__void_fact__pk", "image_upload__verification__size_bytes"
            )[: MAX_EXPORT_IMAGES + 1]
        )
        if len(selected) > MAX_EXPORT_IMAGES:
            raise FieldValidationError(
                "date_to", "annotation_export_too_many_images", {"max_images": MAX_EXPORT_IMAGES}
            )
        total_bytes = sum(size for _, _, _, size in selected)
        if total_bytes > MAX_EXPORT_BYTES:
            raise FieldValidationError(
                "date_to",
                "annotation_export_too_many_bytes",
                {"max_bytes": MAX_EXPORT_BYTES, "total_bytes": total_bytes},
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
                for annotation_id, _, void_id, _ in selected
            ]
        )
        LabNumericDisclosure.objects.bulk_create(
            [
                LabNumericDisclosure(
                    organization=actor.organization,
                    created_by=actor.user,
                    count_id=count_id,
                    surface="annotation_export",
                )
                for _, count_id, _, _ in selected
            ],
            ignore_conflicts=True,
        )
        append_export_status(export, "queued")
        transaction.on_commit(lambda: enqueue_annotation_export(str(export.pk)))
    return export


def require_export_capacity(actor: UploadActor) -> None:
    """Caller holds User then Organization, serializing both global requester and tenant caps."""
    active = EggAnnotationExport.objects.exclude(
        statuses__status__in=["ready", "failed", "expired"]
    )
    if (
        active.filter(created_by=actor.user).exists()
        or active.filter(organization=actor.organization).count() >= 2
    ):
        raise AnnotationExportInProgressError


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
    if not actor.user.is_active or not current_scope(actor).allows(ANNOTATION_EXPORT):
        raise PermissionDenied
    return get_object_or_404(export_rows(actor), pk=identifier)


def resolve_download_membership(user: User, identifier: UUID) -> Membership:
    """An ambiguous headerless cookie download resolves only a current object membership."""
    organization = EggAnnotationExport.objects.filter(pk=identifier).values("organization_id")
    member = get_object_or_404(
        Membership.objects.select_related("organization").filter(
            user=user,
            is_active=True,
            organization__is_active=True,
            organization_id__in=organization,
        )
    )
    member.user = user
    return memoize_effective_scope(member)


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
    export = claim_annotation_export(identifier)
    if export is None:
        return
    stored = None
    try:
        actor = UploadActor(cast(User, export.created_by), export.organization)
        require_export_access(actor, identifier)
        counts, stored = build_stored_annotation_export(export)
        complete_annotation_export(actor, export, (counts, stored))
    except (PermissionDenied, SessionRevokedError):
        record_export_failure(identifier, "annotation_export_requester_unauthorized")
    except Exception:  # noqa: BLE001 -- every job failure is an immutable machine-code fact.
        record_export_failure(identifier)
        logger.exception("Annotation export failed.", extra={"export_id": str(identifier)})
    finally:
        if stored is not None:
            discard_unreferenced_export(export, stored)


def build_stored_annotation_export(
    export: EggAnnotationExport,
) -> tuple["ExportCounts", StoredObject]:
    from lab.annotation_export_archive import build_annotation_archive
    from uploads.storage import store_dataset_export

    stored = None
    try:
        with tempfile.TemporaryFile(mode="w+b") as archive:
            counts = build_annotation_archive(
                export, selected_export_annotations(export).iterator(chunk_size=200), archive
            )
            archive.seek(0)
            stored = store_dataset_export(archive)
    except BaseException:
        if stored is not None:
            discard_unreferenced_export(export, stored)
        raise
    return counts, stored


def complete_annotation_export(
    actor: UploadActor, export: EggAnnotationExport, result: tuple["ExportCounts", StoredObject]
) -> None:
    counts, stored = result
    with numeric_read_transaction(actor):
        require_export_access(actor, export.pk)
        locked = EggAnnotationExport.objects.select_for_update().get(pk=export.pk)
        if next(iter(locked.statuses.all())).status != "running":
            return  # Recovery won; the unreferenced stored object is discarded by the caller.
        append_export_status(
            locked,
            "ready",
            image_count=counts.image_count,
            box_count=counts.box_count,
            point_count=counts.point_count,
            object_key=stored.key,
            size_bytes=stored.size_bytes,
            sha256=stored.sha256,
        )


def discard_unreferenced_export(export: EggAnnotationExport, stored: StoredObject) -> None:
    from uploads.storage import discard_dataset_export

    try:
        # A lost COMMIT acknowledgment must never delete bytes referenced by a retained ready fact.
        if not export.statuses.filter(status="ready", object_key=stored.key).exists():
            discard_dataset_export(stored.key)
    except Exception:  # noqa: BLE001 -- preserve possible committed evidence and the original failure.
        logger.exception("Annotation export cleanup failed.", extra={"export_id": str(export.pk)})


def record_export_failure(identifier: UUID, code: str = "annotation_export_failed") -> bool:
    with transaction.atomic():
        export = EggAnnotationExport.objects.select_for_update().get(pk=identifier)
        status = next(iter(export.statuses.all())).status
        if status in {"ready", "failed", "expired"}:
            return False
        if status == "queued":
            append_export_status(export, "running")
        append_export_status(export, "failed", error_code=code)
        return True


def ready_export(actor: UploadActor, identifier: UUID) -> tuple[EggAnnotationExport, StoredObject]:
    export = require_export_access(actor, identifier)
    state = next(iter(export.statuses.all()))
    if state.status == "expired" or (
        state.status == "ready" and state.created_at <= export_expiry_cutoff()
    ):
        raise AnnotationExportExpiredError
    if state.status != "ready":
        raise AnnotationExportNotReadyError
    return export, StoredObject(state.object_key, state.size_bytes, state.sha256)


def publish_export_totals(actor: UploadActor, exports: Sequence[EggAnnotationExport]) -> None:
    """Publish shared/legacy reads; new requesters disclosed the sealed selection at creation."""
    ready_ids = []
    for export in exports:
        states = list(export.statuses.all())
        # Only the queued policy proves creation-time disclosure, even for an upgraded worker.
        has_creation_disclosure = export.created_by_id == actor.user.pk and any(
            state.status == "queued" and state.policy_version == EXPORT_POLICY_VERSION
            for state in states
        )
        if states[0].status in {"ready", "expired"} and not has_creation_disclosure:
            ready_ids.append(export.pk)
    if not ready_ids:
        return
    counts = list(
        EggCountAttempt.objects.filter(annotation__export_items__export_id__in=ready_ids)
        .filter(
            ~Exists(
                LabNumericDisclosure.objects.filter(count_id=OuterRef("pk"), created_by=actor.user)
            )
        )
        .only("id")
        .distinct()
    )
    publish_numeric_access_batch(actor, counts, NumericPublication(ANNOTATION_EXPORT, "result"))


@dataclass(frozen=True)
class VerifiedAnnotationExportStream:
    archive: BinaryIO
    receipt: StoredObject

    def __iter__(self) -> Iterator[bytes]:
        size, digest, pending = 0, hashlib.sha256(), b""
        try:
            while chunk := self.archive.read(UPLOAD_CHUNK_BYTES):
                size += len(chunk)
                digest.update(chunk)
                if pending:
                    yield pending
                pending = chunk
            if size != self.receipt.size_bytes or digest.hexdigest() != self.receipt.sha256:
                raise UploadStorageError
            yield pending  # A corrupt stream cannot finish its sealed Content-Length.
        finally:
            self.close()

    def close(self) -> None:
        """StreamingHttpResponse also registers this when closed before iteration starts."""
        self.archive.close()


def open_annotation_export(actor: UploadActor, identifier: UUID) -> VerifiedAnnotationExportStream:
    """Log the authorized dispatch once; stat and streaming integrity I/O hold no SQL locks."""
    from uploads.storage import open_dataset_export

    with numeric_read_transaction(actor):
        export, receipt = ready_export(actor, identifier)
        publish_export_totals(actor, [export])
        EggAnnotationExportDownload.objects.create(
            organization=actor.organization, created_by=actor.user, export=export
        )
    archive = open_dataset_export(receipt.key)
    try:
        verify_export_size(archive, receipt)
    except BaseException:
        archive.close()
        raise
    else:
        return VerifiedAnnotationExportStream(archive, receipt)


def verify_export_size(archive: BinaryIO, receipt: StoredObject) -> None:
    if os.fstat(archive.fileno()).st_size != receipt.size_bytes:
        raise UploadStorageError


def export_expiry_cutoff() -> datetime:
    return server_now() - timedelta(days=settings.ANNOTATION_EXPORT_RETENTION_DAYS)


def recover_stale_annotation_exports() -> int:
    cutoff = server_now() - timedelta(
        seconds=EXPORT_TIME_LIMIT_SECONDS + EXPORT_RECOVERY_MARGIN_SECONDS
    )
    identifiers = list(
        EggAnnotationExport.objects.filter(created_at__lt=cutoff)
        .exclude(statuses__status__in=["ready", "failed", "expired"])
        .order_by("created_at", "pk")
        .values_list("pk", flat=True)[:100]
    )
    return sum(
        record_export_failure(identifier, "annotation_export_timed_out")
        for identifier in identifiers
    )


def expire_annotation_export(identifier: UUID) -> bool:
    from uploads.storage import discard_dataset_export

    with transaction.atomic():
        export = EggAnnotationExport.objects.select_for_update().get(pk=identifier)
        state = next(iter(export.statuses.all()))
        if state.status != "ready" or state.created_at > export_expiry_cutoff():
            return False
    discard_dataset_export(state.object_key)
    with transaction.atomic():
        export = EggAnnotationExport.objects.select_for_update().get(pk=identifier)
        if next(iter(export.statuses.all())).status != "ready":
            return False
        append_export_status(
            export,
            "expired",
            image_count=state.image_count,
            box_count=state.box_count,
            point_count=state.point_count,
        )
    return True


def expire_due_annotation_exports() -> int:
    identifiers = list(
        EggAnnotationExport.objects.filter(
            statuses__status="ready", statuses__created_at__lte=export_expiry_cutoff()
        )
        .exclude(statuses__status="expired")
        .order_by("pk")
        .values_list("pk", flat=True)[:100]
    )
    expired = 0
    for identifier in identifiers:
        try:
            expired += expire_annotation_export(identifier)
        except UploadStorageError:
            logger.exception(
                "Annotation export expiry storage failed.", extra={"export_id": str(identifier)}
            )
    return expired
