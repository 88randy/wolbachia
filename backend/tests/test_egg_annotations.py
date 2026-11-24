"""Training marks retain the authoritative count, immutable image and current access."""

from dataclasses import replace
from io import BytesIO
from uuid import uuid4

import pytest
from django.db import DatabaseError, connection, transaction
from PIL import Image

from core.exceptions import FieldValidationError, ImmutableRecordError
from lab.access import LabTarget
from lab.annotation_serializers import EggAnnotationPayloadSerializer
from lab.annotations import validate_mark_bounds
from lab.commands import execute_lab_command
from lab.models import EggAnnotation, EggCountAttempt
from lab.serializers import CountWriteSerializer
from tests.lab_support import (
    actor_with_codes,
    capture_bag,
    command,
    count_input,
    lab_context,
    receive,
)
from tests.uploads_support import verified_upload
from uploads.images import sanitize_image
from uploads.models import AttachmentLink
from uploads.serializers import EvidenceUploadRequestSerializer

POINT = {"kind": "point", "x": 0, "y": 0}
BOX = {"kind": "box", "x": 0, "y": 0, "w": 1, "h": 1}


def annotation_payload(upload_id=None, marks=None):
    return {
        "upload_id": str(upload_id or uuid4()),
        "marks": [BOX, POINT] if marks is None else marks,
        "tool_version": "aedesvision-manual-v1",
        "elapsed_seconds": 12,
    }


@pytest.mark.parametrize(
    "marks",
    [
        [{"kind": "polygon", "x": 0, "y": 0}],
        [{**BOX, "w": 0}],
        [{**POINT, "x": -1}],
        [{**POINT, "x": True}],
        [{**POINT, "x": 0.0}],
        [{**BOX, "extra": 1}],
        [POINT] * 5001,
    ],
)
def test_annotation_rejects_invalid_kind_noninteger_pixels_and_excess_marks(marks):
    parsed = EggAnnotationPayloadSerializer(data=annotation_payload(marks=marks))
    assert not parsed.is_valid()


@pytest.mark.parametrize(
    "mark", [{**POINT, "x": 1}, {**POINT, "y": 1}, {**BOX, "w": 2}, {**BOX, "h": 2}]
)
def test_annotation_rejects_marks_outside_verified_dimensions(mark):
    with pytest.raises(FieldValidationError) as raised:
        validate_mark_bounds([mark], (1, 1))
    assert raised.value.fields == {
        "annotation": [
            {
                "code": "lab_annotation_out_of_bounds",
                "params": {"index": 0, "width": 1, "height": 1},
            }
        ]
    }


def test_count_payload_derives_value_and_rejects_a_different_numeric_value():
    request = {"command_id": str(uuid4()), "annotation": annotation_payload()}
    parsed = CountWriteSerializer(data=request)
    assert parsed.is_valid(), parsed.errors
    assert parsed.validated_data["value"] == 2
    with pytest.raises(FieldValidationError) as raised:
        CountWriteSerializer(data={**request, "value": 3}).is_valid(raise_exception=True)
    assert raised.value.fields["value"][0]["code"] == "lab_annotation_value_mismatch"
    empty = CountWriteSerializer(data={**request, "annotation": annotation_payload(marks=[])})
    assert empty.is_valid(), empty.errors
    assert empty.validated_data["value"] == 0


def test_webp_is_annotation_only_and_verification_orients_and_strips_metadata():
    metadata = {"content_type": "image/webp", "size_bytes": 20, "sha256": "0" * 64}
    assert not EvidenceUploadRequestSerializer(data=metadata).is_valid()
    assert EvidenceUploadRequestSerializer(
        data={**metadata, "purpose": "egg_annotation"}
    ).is_valid()
    blocked = EvidenceUploadRequestSerializer(
        data={
            **metadata,
            "purpose": "egg_annotation",
            "context": {"kind": "incident", "id": str(uuid4())},
        }
    )
    assert not blocked.is_valid()
    image = Image.new("RGBA", (2, 3))
    exif = Image.Exif()
    exif[274] = 6
    output = BytesIO()
    image.save(output, "WEBP", exif=exif, lossless=True)
    cleaned = sanitize_image(output.getvalue(), "image/webp", allow_webp=True)
    assert (cleaned.width, cleaned.height) == (3, 2)
    with Image.open(BytesIO(cleaned.content)) as verified:
        assert not verified.getexif()


@pytest.mark.django_db
def test_annotation_count_is_atomic_replays_and_keeps_new_and_voided_correction(
    monkeypatch, api_client
):
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    upload = verified_upload(context.actor.organization, context.actor.user)
    request = count_input(context, bag, 2, annotation=annotation_payload(upload.public_id))
    outcome = execute_lab_command(context.actor, request)
    assert outcome.status == 201
    original = EggAnnotation.objects.get()
    assert (original.count.value, original.box_count, original.point_count) == (2, 1, 1)
    assert (original.image_width, original.image_height) == (1, 1)
    assert AttachmentLink.objects.get(upload=upload).egg_annotation_id == original.pk
    assert outcome.body["count"]["annotation_id"] == str(original.public_id)
    replay = execute_lab_command(context.actor, request)
    assert replay.replayed
    assert replay.body == outcome.body
    assert EggAnnotation.objects.count() == 1
    new_upload = verified_upload(context.actor.organization, context.actor.user)
    corrected = command(
        context,
        "void_count",
        LabTarget("count", original.count_id),
        {
            "expected_revision": 1,
            "reason_code": "data-entry-error",
            "reason": "Corrected synthetic egg marks",
            "replacement": {
                "kind": "count",
                "confirmed_implausible": False,
                "annotation": annotation_payload(new_upload.public_id, [POINT]),
            },
        },
    )
    assert corrected.status == 200
    replacement = EggAnnotation.objects.exclude(pk=original.pk).get()
    assert replacement.count.replacement_of_id == original.count_id
    assert replacement.count.value == 1
    assert original.count.void_fact
    api_client.force_authenticate(context.actor.user)
    assert api_client.get(f"/api/v1/egg-counts/{original.count_id}/annotation/").data["marks"] == [
        BOX,
        POINT,
    ]
    page = api_client.get(
        "/api/v1/egg-annotations/",
        {"code": bag.code, "author": str(context.actor.user.pk), "page_size": 1},
    )
    assert page.status_code == 200
    assert page.data["count"] == 2
    assert len(page.data["results"]) == 1
    assert page.data["next"]
    with pytest.raises(ImmutableRecordError):
        original.save()
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(
            "UPDATE lab_eggannotation SET tool_version=%s WHERE id=%s", ["changed", original.pk]
        )


@pytest.mark.django_db
def test_invalid_annotation_rolls_back_count_and_unbound_image(monkeypatch):
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    upload = verified_upload(context.actor.organization, context.actor.user)
    with pytest.raises(FieldValidationError):
        execute_lab_command(
            context.actor,
            count_input(
                context,
                bag,
                1,
                annotation=annotation_payload(upload.public_id, [{**POINT, "x": 1}]),
            ),
        )
    assert not EggCountAttempt.objects.exists()
    assert not EggAnnotation.objects.exists()
    assert not AttachmentLink.objects.filter(upload=upload).exists()


@pytest.mark.django_db
def test_annotation_confirmation_and_explicit_replay_keep_same_image(monkeypatch):
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    upload = verified_upload(context.actor.organization, context.actor.user)
    request = count_input(
        context, bag, 1001, annotation=annotation_payload(upload.public_id, [POINT] * 1001)
    )
    blocked = execute_lab_command(context.actor, request)
    assert (blocked.status, blocked.body["code"]) == (409, "lab_confirmation_required")
    assert not EggAnnotation.objects.exists()
    assert not AttachmentLink.objects.exists()
    assert execute_lab_command(context.actor, request).body == blocked.body
    confirmed = replace(
        request, command_id=uuid4(), values={**request.values, "confirmed_implausible": True}
    )
    assert execute_lab_command(context.actor, confirmed).status == 201
    assert EggAnnotation.objects.get().count.value == 1001


@pytest.mark.django_db
def test_annotation_reads_and_images_follow_current_scope_and_org(
    monkeypatch, api_client, org_b, make_member
):
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    upload = verified_upload(context.actor.organization, context.actor.user)
    assert (
        execute_lab_command(
            context.actor,
            count_input(context, bag, 2, annotation=annotation_payload(upload.public_id)),
        ).status
        == 201
    )
    annotation = EggAnnotation.objects.get()
    detail = f"/api/v1/egg-annotations/{annotation.public_id}/"
    download = f"/api/v1/attachments/{upload.public_id}/download/"
    foreign, _member = make_member(org_b, ["egg_count.read"])
    api_client.force_authenticate(foreign)
    assert api_client.get(detail).status_code == 404
    assert api_client.get(download).status_code == 404
    assert api_client.get("/api/v1/egg-annotations/").data["count"] == 0
    denied = actor_with_codes(context, make_member, ("egg_count.create", "field.upload"))
    api_client.force_authenticate(denied.user)
    assert api_client.get(detail).status_code == 403
    assert api_client.get(download).status_code == 404
    assert (
        api_client.get(f"/api/v1/egg-counts/{annotation.count_id}/annotation/").status_code == 403
    )
