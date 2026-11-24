"""Immutable manual observations share the existing count transaction and private bytes."""

from typing import Any, cast
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404

from core.exceptions import FieldValidationError
from lab.access import scoped_bags
from lab.annotation_serializers import EggAnnotationPayloadSerializer
from lab.exceptions import LabConflictError
from lab.models import EggAnnotation, EggCountAttempt
from lab.permissions import COUNT_CREATE, COUNT_READ
from uploads.access import UploadActor
from uploads.limits import FIELD_UPLOAD
from uploads.models import AttachmentLink, Upload, UploadVerification


def annotation_count_values(values: dict[str, Any]) -> dict[str, Any]:
    """Numeric-only command inputs retain their released canonical representation."""
    if "annotation" not in values:
        if "value" not in values:
            raise FieldValidationError("value", "required")
        return values
    count = len(values["annotation"]["marks"])
    if "value" in values and values["value"] != count:
        raise FieldValidationError("value", "lab_annotation_value_mismatch", {"count": count})
    return {**values, "value": count}


def prepare_annotation(
    actor: UploadActor, facts: tuple[Any, dict[str, Any]]
) -> dict[str, Any] | None:
    bag, values = facts
    if "annotation" not in values:
        return None
    payload = EggAnnotationPayloadSerializer(data=values["annotation"])
    payload.is_valid(raise_exception=True)
    annotation = dict(payload.validated_data)
    if not scoped_bags(actor, FIELD_UPLOAD).filter(pk=bag.pk).exists():
        raise Http404
    upload = (
        Upload.objects.filter(organization=actor.organization, public_id=annotation["upload_id"])
        .select_for_update(nowait=True, no_key=True)
        .first()
    )
    if upload is None or upload.uploader_id != actor.user.pk or upload.device_id != actor.device_id:
        raise Http404
    verified = UploadVerification.objects.filter(upload=upload).first()
    if (
        verified is None
        or verified.width < 1
        or verified.height < 1
        or AttachmentLink.objects.filter(upload=upload).exists()
    ):
        raise LabConflictError("lab_annotation_image_required")
    validate_mark_bounds(annotation["marks"], (verified.width, verified.height))
    return {
        **annotation,
        "image_upload": upload,
        "image_width": verified.width,
        "image_height": verified.height,
    }


def validate_mark_bounds(marks: list[dict[str, Any]], dimensions: tuple[int, int]) -> None:
    """Reject outside coordinates; clients clamp gestures before submitting integer pixels."""
    width, height = dimensions
    for index, mark in enumerate(marks):
        if (
            mark["x"] >= width
            or mark["y"] >= height
            or (
                mark["kind"] == "box"
                and (mark["x"] + mark["w"] > width or mark["y"] + mark["h"] > height)
            )
        ):
            raise FieldValidationError(
                "annotation",
                "lab_annotation_out_of_bounds",
                {"index": index, "width": width, "height": height},
            )


def create_count_annotation(count: EggCountAttempt, payload: dict[str, Any] | None) -> None:
    if payload is None:
        return
    marks = payload["marks"]
    boxes = sum(mark["kind"] == "box" for mark in marks)
    annotation = EggAnnotation.objects.create(
        organization=count.organization,
        created_by=count.created_by,
        bag=count.bag,
        count=count,
        image_upload=payload["image_upload"],
        image_width=payload["image_width"],
        image_height=payload["image_height"],
        marks=marks,
        box_count=boxes,
        point_count=len(marks) - boxes,
        tool_version=payload["tool_version"],
        elapsed_seconds=payload.get("elapsed_seconds"),
    )
    AttachmentLink.objects.create(
        organization=count.organization,
        created_by=count.created_by,
        upload=payload["image_upload"],
        egg_annotation=annotation,
    )


def annotation_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[EggAnnotation]:
    from lab.selectors import result_rows

    # Reuse blindness, current whole paired authority and retained voided history.
    counts = result_rows(
        actor,
        EggCountAttempt,
        {"include_voided": True, **({"code": values["code"]} if "code" in values else {})},
    )
    filters = {
        lookup: values[key]
        for key, lookup in {
            "author": "created_by_id",
            "created_from": "created_at__gte",
            "created_before": "created_at__lt",
        }.items()
        if key in values
    }
    return (
        EggAnnotation.objects.filter(organization=actor.organization, count__in=counts, **filters)
        .select_related("bag", "count", "image_upload")
        .order_by("-created_at", "id")
    )


def annotation_projection(annotation: EggAnnotation) -> dict[str, Any]:
    return {
        "id": str(annotation.public_id),
        "public_id": str(annotation.public_id),
        "count": str(annotation.count_id),
        "bag": str(annotation.bag_id),
        "bag_code": annotation.bag.code,
        "upload_id": str(annotation.image_upload.public_id),
        "image_url": f"/api/v1/attachments/{annotation.image_upload.public_id}/download/",
        "image_width": annotation.image_width,
        "image_height": annotation.image_height,
        "marks": annotation.marks,
        "box_count": annotation.box_count,
        "point_count": annotation.point_count,
        "tool_version": annotation.tool_version,
        "elapsed_seconds": annotation.elapsed_seconds,
        "created_by": str(annotation.created_by_id),
        "created_at": annotation.created_at.isoformat(),
    }


def authorize_annotation_download(actor: UploadActor, identifier: UUID) -> None:
    from lab.independent_qa.services import NumericPublication, publish_numeric_access

    annotation = get_object_or_404(annotation_rows(actor, {}), pk=identifier)
    publish_numeric_access(actor, annotation.count, NumericPublication(COUNT_READ, "result"))


def authorize_annotation_attachment(
    actor: UploadActor, identifier: UUID, upload: Upload
) -> dict[str, object]:
    annotation = EggAnnotation.objects.filter(
        organization=actor.organization, pk=identifier, image_upload=upload
    ).first()
    if (
        annotation is None
        or annotation.created_by_id != actor.user.pk
        or upload.device_id != actor.device_id
    ):
        raise Http404
    if not all(
        scoped_bags(actor, permission).filter(pk=annotation.bag_id).exists()
        for permission in (COUNT_CREATE, FIELD_UPLOAD)
    ):
        raise Http404
    return {"egg_annotation": cast(EggAnnotation, annotation)}
