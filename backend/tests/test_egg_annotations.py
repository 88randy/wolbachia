"""Training marks retain the authoritative count, immutable image and current access."""

import hashlib
from dataclasses import replace
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.db import DatabaseError, connection, transaction
from PIL import Image

from core.exceptions import FieldValidationError, ImmutableRecordError
from lab.access import LabTarget
from lab.annotation_serializers import EggAnnotationPayloadSerializer, EggMarkSerializer
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
from uploads.serializers import AttachmentTargetSerializer, EvidenceUploadRequestSerializer

POINT = {"kind": "point", "x": 0, "y": 0}
BOX = {"kind": "box", "x": 0, "y": 0, "w": 1, "h": 1}


def test_annotation_mark_limit_runs_before_child_validation(monkeypatch):
    def reject_child(_self, _value):
        pytest.fail("Oversized marks must never reach child validation")

    monkeypatch.setattr(
        "lab.annotation_serializers.EggMarkSerializer.to_internal_value", reject_child
    )
    parsed = EggAnnotationPayloadSerializer(data=annotation_payload(marks=[POINT] * 5001))
    assert not parsed.is_valid()
    assert parsed.errors["marks"][0].code == "max_length"


def test_invalid_mark_kind_returns_invalid_choice_code():
    parsed = EggAnnotationPayloadSerializer(data=annotation_payload(marks=[{"kind": "polygon"}]))
    assert not parsed.is_valid()
    assert parsed.errors["marks"][0]["kind"][0].code == "invalid_choice"


def test_annotation_parent_is_owned_only_by_the_count_command():
    parsed = AttachmentTargetSerializer(data={"kind": "egg_annotation", "id": str(uuid4())})
    assert not parsed.is_valid()
    assert parsed.errors["kind"][0].code == "invalid_choice"


@pytest.mark.django_db
def test_bound_annotation_transport_replay_keeps_creation_authority_without_read(
    monkeypatch, api_client
):
    from uploads.services import renew_upload

    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    upload = verified_upload(
        context.actor.organization, context.actor.user, purpose="egg_annotation"
    )
    assert (
        execute_lab_command(
            context.actor,
            count_input(context, bag, 2, annotation=annotation_payload(upload.public_id)),
        ).status
        == 201
    )
    profile = context.member.profiles.get()
    profile.permission_codes = [
        code for code in profile.permission_codes if code != "egg_count.read"
    ]
    profile.save(update_fields=["permission_codes"])
    assert renew_upload(context.actor, upload.public_id)["state"] == "verified"
    api_client.force_authenticate(context.actor.user)
    annotation = EggAnnotation.objects.get()
    assert api_client.get(f"/api/v1/egg-annotations/{annotation.public_id}/").status_code == 403


def test_webp_sanitizing_uses_lossy_encoding():
    image = Image.frombytes(
        "RGB", (128, 128), hashlib.shake_256(b"synthetic pixels").digest(128 * 128 * 3)
    )
    original = BytesIO()
    image.save(original, "WEBP", lossless=True)
    cleaned = sanitize_image(original.getvalue(), "image/webp", allow_webp=True)
    assert b"VP8L" not in cleaned.content[:32]
    assert b"VP8 " in cleaned.content[:32]
    assert len(cleaned.content) < len(original.getvalue())


@pytest.mark.django_db
@pytest.mark.parametrize("route", ["bags/{id}/counts", "egg-counts/{id}/void"])
def test_count_body_limit_rejects_before_json_parsing(monkeypatch, api_client, route):
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    api_client.force_authenticate(context.actor.user)
    response = api_client.post(
        f"/api/v1/{route.format(id=bag.pk)}/",
        b"!" * (2 * 1024 * 1024 + 1),
        content_type="application/json",
    )
    assert (response.status_code, response.data["code"]) == (413, "payload_too_large")


@pytest.mark.django_db
def test_annotation_requires_its_own_upload_purpose(monkeypatch):
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    upload = verified_upload(context.actor.organization, context.actor.user)
    outcome = execute_lab_command(
        context.actor,
        count_input(context, bag, 2, annotation=annotation_payload(upload.public_id)),
    )
    assert (outcome.status, outcome.body["code"]) == (409, "lab_annotation_image_required")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "consumer",
    [
        "lab",
        "material",
        "certification",
        "transfer",
        "incident",
        "review",
        "intent",
        "source",
        "permit",
        "pcr",
    ],
)
def test_annotation_uploads_are_rejected_by_other_evidence_consumers(monkeypatch, consumer):
    from core.exceptions import DomainError
    from incidents.evidence import bind_evidence as bind_incident
    from inventory.allocations.evidence import intent_evidence, source_evidence
    from inventory.transfers.commands import TransferAuthority
    from inventory.transfers.evidence import EvidenceRequest, verify_evidence
    from lab.evidence import verified_rejection_evidence
    from lab.pcr.services import _verified_upload
    from lab.shipments.evidence import verified_request_evidence
    from people.evidence import verified_certification_evidence
    from releases.services import _official_document
    from reviews.evidence import bind_review_evidence

    context = lab_context(monkeypatch)
    actor = context.actor
    upload = verified_upload(actor.organization, actor.user, purpose="egg_annotation")
    identifiers = [upload.public_id]
    allowed_rows = SimpleNamespace(filter=lambda **_: SimpleNamespace(exists=lambda: True))
    monkeypatch.setattr("lab.shipments.evidence.request_rows", lambda *_: allowed_rows)
    monkeypatch.setattr("people.evidence.require_contexts", lambda *_: None)
    monkeypatch.setattr("inventory.transfers.evidence.require_transfer_scope", lambda *_: None)
    monkeypatch.setattr("reviews.evidence.original_source_envelope", lambda _: {})
    monkeypatch.setattr("reviews.evidence.subject_facts", lambda *_: None)
    monkeypatch.setattr("inventory.allocations.review.authorize_source", lambda *_: None)
    consumers = {
        "lab": (lambda: verified_rejection_evidence(actor, identifiers), "lab_evidence_required"),
        "material": (
            lambda: verified_request_evidence(actor, SimpleNamespace(pk=uuid4()), identifiers),
            "material_evidence_required",
        ),
        "certification": (
            lambda: verified_certification_evidence(actor, None, identifiers),
            "certification_evidence_required",
        ),
        "transfer": (
            lambda: verify_evidence(
                TransferAuthority(actor),
                SimpleNamespace(organization=actor.organization),
                EvidenceRequest(tuple(identifiers)),
            ),
            "transfer_evidence_required",
        ),
        "incident": (
            lambda: bind_incident(
                actor, SimpleNamespace(pk=uuid4(), source_event_id=None), identifiers, 1
            ),
            "incident_evidence_not_ready",
        ),
        "review": (
            lambda: bind_review_evidence(
                actor, SimpleNamespace(field_event=None, pk=uuid4()), identifiers
            ),
            "review_evidence_not_ready",
        ),
        "intent": (
            lambda: intent_evidence(
                actor,
                SimpleNamespace(
                    declared_evidence=[{"upload_id": str(upload.public_id), "role": "photo"}]
                ),
            ),
            "supply_evidence_required",
        ),
        "permit": (
            lambda: _official_document(actor, {"official_document_id": upload.public_id}),
            "permit_document_not_ready",
        ),
        "source": (
            lambda: source_evidence(
                SimpleNamespace(
                    organization=actor.organization,
                    user=actor.user,
                    device=SimpleNamespace(pk=actor.device_id),
                    review_authorization=object(),
                    envelope=SimpleNamespace(payload={}, id=uuid4()),
                ),
                {"photo": identifiers},
            ),
            "supply_evidence_required",
        ),
        "pcr": (
            lambda: _verified_upload(actor, upload.public_id, "file", frozenset({"image/png"})),
            "pcr_file_not_ready",
        ),
    }
    consume, expected_code = consumers[consumer]
    with pytest.raises(DomainError) as raised:
        consume()
    error = raised.value
    codes = {error.code}
    codes.update(item["code"] for values in (error.fields or {}).values() for item in values)
    codes.update(item.get("code", item.get("reason")) for item in getattr(error, "blocked_by", []))
    assert expected_code in codes


def test_annotation_upload_is_never_linked_as_source_evidence():
    from uploads.gates import _ready_for_event
    from uploads.linking import _link_declared

    upload = SimpleNamespace(purpose="egg_annotation", content_type="image/png")
    assert not _link_declared(None, upload, uuid4())
    assert not _ready_for_event(upload, uuid4())


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
    upload = verified_upload(
        context.actor.organization, context.actor.user, purpose="egg_annotation"
    )
    request = count_input(
        context, bag, 2, annotation=annotation_payload(upload.public_id), queue_context={}
    )
    parsed_marks = []
    parse_mark = EggMarkSerializer.to_internal_value

    def observe_mark(serializer, value):
        parsed_marks.append(value)
        return parse_mark(serializer, value)

    monkeypatch.setattr(EggMarkSerializer, "to_internal_value", observe_mark)
    api_client.force_authenticate(context.actor.user)
    response = api_client.post(
        f"/api/v1/bags/{bag.pk}/counts/",
        {"command_id": str(request.command_id), **request.values},
        format="json",
    )
    outcome = SimpleNamespace(status=response.status_code, body=response.data)
    assert outcome.status == 201
    assert len(parsed_marks) == 2  # Each mark is validated once, at the command boundary.
    original = EggAnnotation.objects.get()
    assert (original.count.value, original.box_count, original.point_count) == (2, 1, 1)
    assert (original.image_width, original.image_height) == (1, 1)
    assert AttachmentLink.objects.get(upload=upload).egg_annotation_id == original.pk
    assert outcome.body["count"]["annotation_id"] == str(original.public_id)
    replay = execute_lab_command(context.actor, request)
    assert replay.replayed
    assert replay.body == outcome.body
    assert EggAnnotation.objects.count() == 1
    new_upload = verified_upload(
        context.actor.organization, context.actor.user, purpose="egg_annotation"
    )
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
    projection = page.data["results"][0]
    assert projection["id"]
    assert "public_id" not in projection
    assert projection["image_url"] == f"/api/v1/attachments/{projection['upload_id']}/download/"
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
    upload = verified_upload(
        context.actor.organization, context.actor.user, purpose="egg_annotation"
    )
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
    upload = verified_upload(
        context.actor.organization, context.actor.user, purpose="egg_annotation"
    )
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
    upload = verified_upload(
        context.actor.organization, context.actor.user, purpose="egg_annotation"
    )
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
