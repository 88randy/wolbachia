"""One public Lab wiring/authority owner; pure metadata checks run without PostgreSQL."""

from uuid import uuid4

import pytest

from accounts.models import User
from lab.serializers import CountWriteSerializer, LabReplacementSerializer


def test_lab_structural_commands_preserve_integer_and_closed_replacement_contract():
    invalid = CountWriteSerializer(data={"command_id": str(uuid4()), "value": "0"})
    assert not invalid.is_valid()
    assert invalid.errors["value"][0].code == "invalid"
    partial = CountWriteSerializer(
        data={"command_id": str(uuid4()), "value": 0, "total_examined": 0}
    )
    assert not partial.is_valid()
    assert {"viable_eggs", "method_version"} <= partial.errors.keys()
    valid = CountWriteSerializer(data={"command_id": str(uuid4()), "value": 0})
    assert valid.is_valid(), valid.errors
    assert valid.validated_data["value"] == 0
    replacement = LabReplacementSerializer(
        data={"kind": "count", "value": 1, "bag_id": str(uuid4())}
    )
    assert not replacement.is_valid()
    assert replacement.errors["bag_id"][0].code == "unknown_field"


def test_lab_public_schema_preserves_authentic_actions_and_single_history_owner(api_client):
    api_client.force_authenticate(User(pk=uuid4(), username="synthetic-lab-schema-reader"))
    response = api_client.get("/api/v1/schema/", {"format": "json"})
    assert response.status_code == 200
    schema = response.json()
    for route in (
        "bags/receive/",
        "readings/{id}/receive/",
        "bags/{id}/counts/",
        "bags/{id}/rejections/",
        "egg-counts/queue/",
        "egg-counts/{id}/void-context/",
        "lab-rejections/{id}/void-context/",
        "lab-reception-incident-policy/versions/",
        "recount-requests/",
    ):
        assert "/api/v1/" + route in schema["paths"]
    mapping = schema["components"]["schemas"]["CourierHistoryEntry"]["discriminator"]["mapping"]
    assert {
        "review_decision",
        "shift_validation",
        "relocation_proposal",
        "transfer_custody",
        "lab_receipt",
        "lab_count",
        "lab_discrepancy",
        "lab_rejection",
        "lab_void",
    } == mapping.keys()
    history = schema["components"]["schemas"]["LabHistoryEntry"]["properties"]
    for field in ("count_id", "rejection_id"):
        assert history[field] == {"type": "string", "format": "uuid", "nullable": True}
    count_body = schema["paths"]["/api/v1/bags/{id}/counts/"]["post"]["requestBody"]
    assert count_body["required"] is True
    reference = count_body["content"]["application/json"]["schema"]["$ref"].split("/")[-1]
    fields = schema["components"]["schemas"][reference]
    assert fields["properties"]["value"]["maximum"] == 2**53 - 1
    assert "/api/v1/lab-rejections/queue/" not in schema["paths"]
    replacement = schema["components"]["schemas"]["LabVoidRequest"]["properties"]["replacement"][
        "$ref"
    ].split("/")[-1]
    variants = schema["components"]["schemas"][replacement]
    assert set(variants["discriminator"]["mapping"]) == {"count", "rejection"}
    count_variant = variants["discriminator"]["mapping"]["count"].split("/")[-1]
    assert {"kind", "value"} <= set(schema["components"]["schemas"][count_variant]["required"])


@pytest.mark.django_db
def test_unknown_foreign_and_current_pair_denial_create_no_scan_facts(
    api_client, monkeypatch, org_b, make_member
):
    from lab.models import BagReceipt, LabCommand, ReceptionDiscrepancy
    from organizations.models import all_scope, default_scope
    from tests.lab_support import capture_bag, lab_context

    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    api_client.force_authenticate(context.actor.user)
    unknown = api_client.post(
        "/api/v1/bags/receive/", {"code": "UNKNOWN", "command_id": str(uuid4())}, format="json"
    )
    assert unknown.status_code == 404
    user, member = make_member(org_b, ["bag.receive"])
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    api_client.force_authenticate(user)
    foreign = api_client.post(
        "/api/v1/bags/receive/", {"code": bag.code, "command_id": str(uuid4())}, format="json"
    )
    assert (foreign.status_code, foreign.data["code"]) == (
        unknown.status_code,
        unknown.data["code"],
    )
    api_client.force_authenticate(context.actor.user)
    context.field.membership.scope = default_scope()
    context.field.membership.save(update_fields=["scope"])
    denied = api_client.post(
        "/api/v1/bags/receive/", {"code": bag.code, "command_id": str(uuid4())}, format="json"
    )
    assert denied.status_code == 404
    context.field.membership.scope = {
        "centers": {"mode": "selected", "ids": []},
        "quadrants": {"mode": "all", "ids": []},
    }
    context.field.membership.save(update_fields=["scope"])
    assert (
        api_client.post(
            "/api/v1/bags/receive/", {"code": bag.code, "command_id": str(uuid4())}, format="json"
        ).status_code
        == 404
    )
    from geography.models import Quadrant
    from organizations.models import Center
    from tests.factories import ProfileFactory

    wrong_center = Center.objects.create(
        organization=context.actor.organization, code="LAB-OTHER", name="Synthetic other center"
    )
    wrong_quadrant = Quadrant.objects.create(
        organization=context.actor.organization, center=wrong_center, code="LAB-OTHER-Q"
    )
    actual_quadrant = context.field.point.block.quadrant
    profiles = [
        ProfileFactory(
            organization=context.actor.organization,
            permission_codes=["bag.receive"],
            scope={
                "centers": {"mode": "selected", "ids": [str(center)]},
                "quadrants": {"mode": "selected", "ids": [str(quadrant)]},
            },
        )
        for center, quadrant in (
            (actual_quadrant.center_id, wrong_quadrant.pk),
            (wrong_center.pk, actual_quadrant.pk),
        )
    ]
    context.field.membership.scope = all_scope()
    context.field.membership.save(update_fields=["scope"])
    context.field.membership.profiles.set(profiles)
    crossed = api_client.post(
        "/api/v1/bags/receive/", {"code": bag.code, "command_id": str(uuid4())}, format="json"
    )
    assert crossed.status_code == 404
    assert not LabCommand.objects.exists()
    assert not BagReceipt.objects.exists()
    assert not ReceptionDiscrepancy.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["count", "rejection"])
def test_void_only_target_context_is_usable_without_list_queue_or_replacement_grants(
    api_client, monkeypatch, make_member, kind
):
    from lab.access import LabTarget
    from lab.commands import execute_lab_command
    from organizations.models import all_scope
    from tests.lab_support import (
        capture_bag,
        command,
        count_input,
        lab_context,
        receive,
        synthetic_method,
    )
    from tests.uploads_support import verified_upload

    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    if kind == "count":
        original = execute_lab_command(context.actor, count_input(context, bag, 0)).body["count"][
            "id"
        ]
    else:
        method = synthetic_method(context)
        upload = verified_upload(context.actor.organization, context.actor.user)
        original = command(
            context,
            "reject",
            LabTarget("bag", bag.pk),
            {
                "expected_revision": 0,
                "method_version": method.pk,
                "reason": "Synthetic laboratory rejection",
                "evidence_ids": [upload.public_id],
            },
        ).body["rejection"]["id"]
    user, member = make_member(context.actor.organization, ["egg_count.void"])
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    api_client.force_authenticate(user)
    collection = "egg-counts" if kind == "count" else "lab-rejections"
    target = f"/api/v1/{collection}/{original}/"
    for route in ("/api/v1/egg-counts/", "/api/v1/egg-counts/queue/", target):
        assert api_client.get(route).status_code == 403
    minimal = api_client.get(target + "void-context/")
    assert minimal.status_code == 200
    assert minimal.data["value"] == (0 if kind == "count" else None)
    if kind == "rejection":
        from lab.evidence import authorize_rejection_download
        from uploads.access import UploadActor

        authorize_rejection_download(UploadActor(user, context.actor.organization), original)
        assert minimal.data["evidence_ids"] == [str(upload.public_id)]
    assert "source_proof" not in minimal.data
    values = {
        "command_id": str(uuid4()),
        "expected_revision": 1,
        "reason_code": "other",
        "reason": "Retain the original observed count",
        "replacement": {"kind": "count", "value": 1},
    }
    assert api_client.post(target + "void/", values, format="json").status_code == 404
    values.pop("replacement")
    values["command_id"] = str(uuid4())
    assert api_client.post(target + "void/", values, format="json").status_code == 200


@pytest.mark.django_db
def test_real_cookie_command_keeps_csrf_and_committed_receipt_wiring(monkeypatch):
    from rest_framework.test import APIClient

    from tests.lab_support import capture_bag, lab_context

    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(context.actor.user)
    values = {"code": bag.code, "command_id": str(uuid4())}
    assert client.post("/api/v1/bags/receive/", values, format="json").status_code == 403
    assert client.get("/api/v1/auth/csrf/").status_code == 204
    token = client.cookies["csrftoken"].value
    result = client.post("/api/v1/bags/receive/", values, format="json", HTTP_X_CSRFTOKEN=token)
    assert result.status_code == 200
    assert result.data["receipt"]["reading_id"] == str(bag.reading_id)
