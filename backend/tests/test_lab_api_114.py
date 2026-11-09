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
    from lab.independent_qa.serializers import IndependentCountSerializer, RecountClaimSerializer

    independent = IndependentCountSerializer(
        data={
            "command_id": str(uuid4()),
            "request_id": str(uuid4()),
            "expected_revision": 1,
            "expected_result_revision": 1,
            "value": 0,
            "method_version": str(uuid4()),
        }
    )
    assert independent.is_valid(), independent.errors
    incomplete_measurement = IndependentCountSerializer(
        data={**independent.initial_data, "viable_eggs": 0}
    )
    assert not incomplete_measurement.is_valid()
    assert "total_examined" in incomplete_measurement.errors
    claim = RecountClaimSerializer(
        data={
            "command_id": str(uuid4()),
            "expected_revision": 0,
            "role": "second",
            "counter_id": str(uuid4()),
        }
    )
    assert not claim.is_valid()
    assert claim.errors["counter_id"][0].code == "unknown_field"
    from lab.independent_qa.serializers import PaddleReuseSerializer

    naive = PaddleReuseSerializer(
        data={
            "command_id": str(uuid4()),
            "expected_revision": 1,
            "binding_id": str(uuid4()),
            "expected_result_revision": 1,
            "expected_qa_revision": 0,
            "destination_location_id": str(uuid4()),
            "source_movement_id": str(uuid4()),
            "washed_at": "2026-11-07T12:00:00",
            "dried_at": "2026-11-07T12:10:00Z",
            "method_version": str(uuid4()),
            "evidence_ids": [str(uuid4())],
        }
    )
    assert not naive.is_valid()
    assert naive.errors["washed_at"][0].code == "invalid"


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
        "recounts/",
        "recounts/{id}/claim/",
        "recounts/{id}/adjudicate/",
        "recounts/{id}/independence-attestations/",
        "bags/{id}/recount/",
        "egg-paddles/",
        "egg-paddles/{id}/bindings/",
        "egg-paddles/{id}/reuses/",
        "lab-qa-policy/",
    ):
        assert "/api/v1/" + route in schema["paths"]
    mapping = schema["components"]["schemas"]["CourierHistoryEntry"]["discriminator"]["mapping"]
    assert {
        "review_decision",
        "shift_validation",
        "relocation_proposal",
        "transfer_custody",
        "supply_plan",
        "supply_release",
        "supply_cancel",
        "supply_receipt",
        "supply_reconcile",
        "supply_return",
        "supply_justify",
        "supply_bag_disposal",
        "lab_receipt",
        "lab_count",
        "lab_discrepancy",
        "lab_rejection",
        "lab_void",
        "community_activity",
        "lab_recount",
        "lab_adjudication",
        "lab_paddle_reuse",
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
def test_real_cookie_command_keeps_csrf_and_committed_receipt_wiring(monkeypatch, make_member):
    from rest_framework.test import APIClient

    from tests.lab_support import capture_bag, lab_context

    context = lab_context(monkeypatch)
    bag = capture_bag(context, has_eggs=False)
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(context.actor.user)
    values = {"code": bag.code, "command_id": str(uuid4())}
    assert client.post("/api/v1/bags/receive/", values, format="json").status_code == 403
    assert client.get("/api/v1/auth/csrf/").status_code == 204
    token = client.cookies["csrftoken"].value
    result = client.post("/api/v1/bags/receive/", values, format="json", HTTP_X_CSRFTOKEN=token)
    assert result.status_code == 200
    assert result.data["receipt"]["reading_id"] == str(bag.reading_id)
    from lab.models import LabNumericDisclosure, RecountRequest
    from tests.lab_support import actor_with_codes
    from tests.test_lab_recounts_b_19 import configure_qa

    qa_method = configure_qa(context)
    counted = client.post(
        f"/api/v1/bags/{bag.pk}/counts/",
        {"command_id": str(uuid4()), "expected_revision": 0, "value": 1},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert counted.status_code == 201
    request = RecountRequest.objects.get(count_id=counted.data["count"]["id"])
    blind = actor_with_codes(
        context,
        make_member,
        ["reading.read", "bag.receive", "egg_count.read", "egg_count.void", "recount.create"],
    )
    client.force_login(blind.user)
    assert client.get("/api/v1/auth/csrf/").status_code == 204
    token = client.cookies["csrftoken"].value
    assert client.get(f"/api/v1/bags/{bag.pk}/").data["lab"] is None
    listed = client.get("/api/v1/bags/", {"code": bag.code})
    assert listed.data["count"] == 1
    assert listed.data["results"][0]["lab"] is None
    assert (
        client.get(
            "/api/v1/bags/", {"code": bag.code, "lab_status": "awaiting_independent_qa"}
        ).data["count"]
        == 0
    )
    assert client.get("/api/v1/egg-counts/", {"code": bag.code}).data["count"] == 0
    assert (
        client.get(f"/api/v1/egg-counts/{counted.data['count']['id']}/void-context/").status_code
        == 404
    )
    queued = client.get("/api/v1/recounts/", {"code": bag.code})
    assert queued.status_code == 200
    assert queued.data["results"][0]["id"] == str(request.pk)
    assert not {"value", "viability", "causes", "first_counter"} & queued.data["results"][0].keys()
    assert not LabNumericDisclosure.objects.filter(created_by=blind.user).exists()
    claim = {"command_id": str(uuid4()), "expected_revision": 0, "role": "second"}
    route = f"/api/v1/recounts/{request.pk}/claim/"
    assert client.post(route, claim, format="json").status_code == 403
    assert client.post(route, claim, format="json", HTTP_X_CSRFTOKEN=token).status_code == 201
    assert client.get("/api/v1/recount-requests/", {"code": bag.code}).data["count"] == 0
    independent = client.post(
        f"/api/v1/bags/{bag.pk}/recount/",
        {
            "command_id": str(uuid4()),
            "request_id": str(request.pk),
            "expected_revision": 1,
            "expected_result_revision": 1,
            "value": 0,
            "method_version": str(qa_method.pk),
        },
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert independent.status_code == 201
    detailed = client.get("/api/v1/recount-requests/", {"code": bag.code})
    assert detailed.status_code == 200
    details = detailed.data["results"][0]["independent_qa"]
    assert details["resolution"] is None
    assert [(row["candidate_kind"], row["value"]) for row in details["candidates"]] == [
        ("first", 1),
        ("second", 0),
    ]
    chosen = next(row for row in details["candidates"] if row["candidate_kind"] == "second")
    assert chosen["method"]["id"] == str(qa_method.pk)
    assert chosen["id"] == independent.data["attempt"]["id"]
    decision = client.post(
        f"/api/v1/recounts/{request.pk}/adjudicate/",
        {
            "command_id": str(uuid4()),
            "expected_revision": details["expected_revision"],
            "expected_result_revision": details["expected_result_revision"],
            "final_attempt_id": chosen["id"],
            "reason_code": "other",
            "reason": "Choose the genuine own second observation through its public typed candidate",
        },
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert decision.status_code == 201
    selected = client.get("/api/v1/recount-requests/", {"code": bag.code}).data["results"][0][
        "independent_qa"
    ]["resolution"]
    assert (selected["candidate_kind"], selected["final_attempt_id"]) == ("second", chosen["id"])
    # A successful state facet can disclose even when the selected page is empty.
    exposed = actor_with_codes(context, make_member, ["reading.read", "bag.receive"])
    client.force_login(exposed.user)
    assert client.get("/api/v1/auth/csrf/").status_code == 204
    token = client.cookies["csrftoken"].value
    assert (
        client.get("/api/v1/bags/", {"code": bag.code, "lab_status": "rejected"}).data["count"] == 0
    )
    assert (
        LabNumericDisclosure.objects.filter(
            created_by=exposed.user, count_id=request.count_id
        ).count()
        == 1
    )
    profile = exposed.user.memberships.get(organization=context.actor.organization).profiles.get()
    profile.permission_codes += ["recount.create"]
    profile.save(update_fields=["permission_codes"])
    refused = client.post(
        route,
        {**claim, "command_id": str(uuid4()), "expected_revision": 3},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert (refused.status_code, refused.data["code"]) == (409, "lab_recount_disclosed")
