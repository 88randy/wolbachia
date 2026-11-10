"""B-21's collection, immutable result inputs and current authority acceptance owner."""

import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.db import DatabaseError, close_old_connections, connection, transaction
from django.http import Http404
from psycopg import sql
from rest_framework.test import APIClient

from field_sync.envelope import describe_payload
from field_sync.models import FieldEvent
from lab.exceptions import LabConflictError, LabInProgressError
from lab.methods import decide_method, write_method
from lab.permissions import ADMIN_CODES
from lab.samples.models import SampleReceipt, WolbachiaResultAttempt, WolbachiaSample
from lab.samples.payloads import CollectSampleSerializer, SampleResultSerializer
from lab.samples.selectors import prevalence_inputs, sample_snapshot
from organizations.models import Organization, all_scope
from ovitraps.models import OvitrapReading
from tests.ovitrap_support import CAPTURED, envelope, ingest, setup_field
from tests.review_support import audit_current_membership
from uploads.access import UploadActor

SAMPLE_CODES = (
    "sample.read",
    "sample.collect",
    "sample.receive",
    "sample.result_create",
    "sample.void",
    "review_item.read",
    "review_item.decide",
)


@pytest.fixture
def samples_context(monkeypatch):
    """The technical method predates capture and certifies no real assay protocol."""
    clock = {"now": CAPTURED}
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock["now"])
    field = setup_field()
    field.profile.permission_codes = [*field.profile.permission_codes, *ADMIN_CODES, *SAMPLE_CODES]
    field.profile.save(update_fields=["permission_codes"])
    audit_current_membership(field.membership)
    assert ingest(field, envelope(field)).status == "accepted"
    source = envelope(field, "ovitrap.check")
    assert ingest(field, source).status == "accepted"
    reading = OvitrapReading.objects.get(event_id=source.id)
    actor = UploadActor(field.batch.user, field.batch.organization)
    method = write_method(
        actor,
        {
            "code": "SYNTHETIC-WOLBACHIA-117",
            "name": "Synthetic technical method, not an operational assay",
            "procedure": "Synthetic immutable result fixture only",
            "reference": "Synthetic technical reference, not biological approval",
            "effective_from": CAPTURED - timedelta(days=1),
            "supports_viability": False,
            "supports_rejection": False,
            "supports_wolbachia": True,
        },
    )
    decide_method(
        actor,
        method.pk,
        {"expected_revision": 0, "decision": "verify", "reference": "Synthetic test verification"},
    )
    clock["now"] += timedelta(minutes=1)
    field.batch = replace(field.batch, sent_at=clock["now"], received_at=clock["now"])
    return SimpleNamespace(field=field, actor=actor, method=method, reading=reading, clock=clock)


def sample_capture(context, **overrides):
    values = {
        "sample_id": str(uuid4()),
        "code": "SYNTHETIC-117",
        "origin_code": "other",
        "other_text": "Synthetic reading sample",
        "method_version": str(context.method.pk),
        "source_ref": {"kind": "reading", "id": str(context.reading.pk)},
        "evidence_ids": [],
        **overrides,
    }
    return replace(
        envelope(context.field, "sample.collect"),
        device_time=context.clock["now"],
        payload=values,
        payload_info=describe_payload(values),
    )


def collect(context, **overrides):
    capture = sample_capture(context, **overrides)
    outcome = ingest(context.field, capture)
    assert outcome.status == "accepted", outcome
    return WolbachiaSample.objects.get(event_id=capture.id), capture


def sample_command(context, sample, action, **values):
    from lab.samples.services import SampleCommand, execute_sample_command

    request = SampleCommand(action, uuid4(), values)
    return execute_sample_command(context.actor, sample.pk, request)


def result_values(context, status, result=None, repeat_of=None):
    return {
        "status": status,
        "result": result,
        "method_version": context.method.pk,
        "repeat_of": repeat_of,
    }


def test_wire_requires_explicit_binary_result_and_closed_sample_source():
    valid = {
        "command_id": str(uuid4()),
        "status": "valid",
        "result": "negative",
        "method_version": str(uuid4()),
    }
    for status, result, accepted in (
        ("valid", "positive", True),
        ("valid", "negative", True),
        ("valid", None, False),
        ("invalid", None, True),
        ("disputed", None, True),
        ("invalid", "negative", False),
        ("disputed", "positive", False),
    ):
        command = SampleResultSerializer(data={**valid, "status": status, "result": result})
        assert command.is_valid() is accepted, command.errors
    capture = {
        "sample_id": str(uuid4()),
        "code": "SYNTHETIC-117",
        "origin_code": "other",
        "method_version": str(uuid4()),
        "source_ref": {"kind": "reading", "id": str(uuid4())},
    }
    for patch in (
        {"organization_id": str(uuid4())},
        {"source_ref": {"kind": "invented", "id": str(uuid4())}},
        {"source_ref": {"kind": "reading", "id": 42}},
        {"sample_id": True},
    ):
        command = CollectSampleSerializer(data={**capture, **patch})
        assert not command.is_valid(), patch


@pytest.mark.django_db
def test_collection_and_reception_replay_keep_one_sample_and_exact_original_source(samples_context):
    from lab.samples.services import SampleCommand, execute_sample_command

    context = samples_context
    sample, capture = collect(context)
    assert ingest(context.field, capture).status == "accepted"
    context.field.profile.permission_codes = [
        code for code in context.field.profile.permission_codes if code != "sample.read"
    ]
    context.field.profile.save(update_fields=["permission_codes"])
    request = SampleCommand("receive", uuid4(), {})
    first = execute_sample_command(context.actor, sample.pk, request)
    assert set(first) == {"sample_id", "receipt", "attempt"}
    assert first["attempt"] is None
    context.clock["now"] += timedelta(minutes=1)
    assert execute_sample_command(context.actor, sample.pk, request) == first
    assert WolbachiaSample.objects.count() == SampleReceipt.objects.count() == 1
    assert sample.reading_id == context.reading.pk
    assert sample.method_version_id == context.method.pk
    assert sample.event_id == capture.id
    assert sample.device_time == capture.device_time
    assert sample.server_received_at == context.field.batch.received_at
    assert sample.origin_snapshot["code"] == "other"
    changed = replace(capture, manual_capture=not capture.manual_capture)
    assert ingest(context.field, changed).code == "event_id_conflict"
    with pytest.raises(LabConflictError):
        execute_sample_command(context.actor, sample.pk, replace(request, action="results"))


@pytest.mark.django_db
@pytest.mark.parametrize("final_result", ["positive", "negative"])
def test_invalid_disputed_repeat_retains_all_attempts_and_only_valid_final_input(
    samples_context, final_result
):
    from lab.samples.services import SampleCommand, execute_sample_command

    context = samples_context
    sample, _capture = collect(context)
    sample_command(context, sample, "receive")
    missing = sample_snapshot(WolbachiaSample.objects.get(pk=sample.pk))
    assert missing["result_status"] == "missing"
    assert missing["selected_valid_result"] is None
    assert prevalence_inputs(WolbachiaSample.objects.all()) == {
        "positive": 0,
        "tested": 0,
        "prevalence": None,
    }
    for status in ("invalid", "disputed"):
        latest = sample.attempts.order_by("-revision").first()
        sample_command(
            context,
            sample,
            "results",
            **result_values(context, status, repeat_of=None if latest is None else latest.pk),
        )
        projection = sample_snapshot(WolbachiaSample.objects.get(pk=sample.pk))
        assert projection["result_status"] == status
        assert projection["selected_valid_result"] is None
        assert not projection["numerator_eligible"]
        assert not projection["denominator_eligible"]
        assert prevalence_inputs(WolbachiaSample.objects.all())["prevalence"] is None
    latest = sample.attempts.order_by("-revision").get(revision=2)
    request = SampleCommand(
        "results", uuid4(), result_values(context, "valid", final_result, latest.pk)
    )
    first = execute_sample_command(context.actor, sample.pk, request)
    assert execute_sample_command(context.actor, sample.pk, request) == first
    projection = sample_snapshot(WolbachiaSample.objects.get(pk=sample.pk))
    assert [row["status"] for row in projection["attempts"]] == ["invalid", "disputed", "valid"]
    assert projection["selected_valid_result"]["result"] == final_result
    assert projection["denominator_eligible"] is True
    assert projection["numerator_eligible"] is (final_result == "positive")
    assert prevalence_inputs(WolbachiaSample.objects.all()) == {
        "positive": int(final_result == "positive"),
        "tested": 1,
        "prevalence": float(final_result == "positive"),
    }
    with pytest.raises(LabConflictError):
        sample_command(
            context, sample, "results", **result_values(context, "invalid", repeat_of=latest.pk)
        )
    assert WolbachiaResultAttempt.objects.count() == 3


@pytest.mark.django_db
def test_results_need_receipt_and_exact_latest_repeat_without_replacing_valid_history(
    samples_context,
):
    context = samples_context
    sample, _capture = collect(context)
    with pytest.raises(LabConflictError):
        sample_command(context, sample, "results", **result_values(context, "invalid"))
    assert not sample.attempts.exists()
    sample_command(context, sample, "receive")
    sample_command(context, sample, "results", **result_values(context, "invalid"))
    for predecessor in (None, uuid4()):
        with pytest.raises(LabConflictError):
            sample_command(
                context,
                sample,
                "results",
                **result_values(context, "valid", "negative", predecessor),
            )
    assert list(sample.attempts.values_list("status", "result")) == [("invalid", None)]


@pytest.mark.django_db
def test_wolbachia_requires_explicit_capability_and_foreign_method_is_opaque(
    samples_context, org_b
):
    from lab.samples.methods import wolbachia_method

    context = samples_context
    with pytest.raises(Http404):
        wolbachia_method(org_b, context.method.pk, context.clock["now"])
    not_an_assay = write_method(
        context.actor,
        {
            "expected_revision": 1,
            "name": "Synthetic method without a Wolbachia capability",
            "procedure": "Synthetic unrelated technical procedure",
            "reference": "Synthetic test reference only",
            "effective_from": context.clock["now"],
            "supports_viability": True,
            "supports_rejection": False,
            "supports_wolbachia": False,
        },
        context.method.method_id,
    )
    decide_method(
        context.actor,
        not_an_assay.pk,
        {
            "expected_revision": 0,
            "decision": "verify",
            "reference": "Synthetic unrelated verification",
        },
    )
    verdict = ingest(context.field, sample_capture(context, method_version=str(not_an_assay.pk)))
    assert (verdict.status, verdict.code) == ("in_review", "sample_configuration_unavailable")
    assert not WolbachiaSample.objects.exists()


@pytest.mark.django_db
def test_method_withdrawal_blocks_new_attempt_but_keeps_original_method_and_saved_reply(
    samples_context,
):
    from lab.samples.services import SampleCommand, execute_sample_command

    context = samples_context
    sample, _capture = collect(context)
    sample_command(context, sample, "receive")
    original = SampleCommand("results", uuid4(), result_values(context, "invalid"))
    first = execute_sample_command(context.actor, sample.pk, original)
    invalid = sample.attempts.get()
    context.clock["now"] += timedelta(minutes=1)
    decide_method(
        context.actor,
        context.method.pk,
        {
            "expected_revision": 1,
            "decision": "withdraw",
            "reference": "Withdraw synthetic technical verification",
        },
    )
    with pytest.raises(LabConflictError) as unavailable:
        sample_command(
            context, sample, "results", **result_values(context, "valid", "negative", invalid.pk)
        )
    assert unavailable.value.code == "sample_configuration_unavailable"
    assert execute_sample_command(context.actor, sample.pk, original) == first
    retained = sample_snapshot(WolbachiaSample.objects.get(pk=sample.pk))
    assert len(retained["attempts"]) == 1
    assert retained["attempts"][0]["method_version_id"] == str(context.method.pk)
    assert retained["attempts"][0]["method"]["reference"] == context.method.reference
    assert retained["selected_valid_result"] is None


@pytest.mark.django_db
def test_in_review_collection_has_no_effect_and_authorized_acceptance_keeps_ingest(samples_context):
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.models import ReviewItem

    context = samples_context
    context.field.batch = replace(context.field.batch, is_final_upload=True)
    capture = sample_capture(context)
    verdict = ingest(context.field, capture)
    assert (verdict.status, verdict.code) == ("in_review", "final_upload_after_revoke")
    assert not WolbachiaSample.objects.exists()
    assert not SampleReceipt.objects.exists()
    assert not WolbachiaResultAttempt.objects.exists()
    original = FieldEvent.objects.get(pk=capture.id)
    review = ReviewItem.objects.get(field_event=original)
    decide_review(
        context.actor,
        review.pk,
        ReviewDecisionRequest(
            "accept", 0, "Accept retained synthetic collection and original method proof"
        ),
    )
    original.refresh_from_db()
    sample = WolbachiaSample.objects.get(event=original)
    assert original.status == "in_review"
    assert original.status_code == "final_upload_after_revoke"
    assert sample.device_time == original.device_time
    assert sample.server_received_at == original.server_received_at
    assert sample.method_version_id == context.method.pk
    assert ingest(context.field, capture).code == verdict.code
    assert WolbachiaSample.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(("action", "expected_status"), [("accept", 409), ("void", 201)])
def test_pending_sample_review_after_collector_permission_loss_has_no_effects(
    samples_context, action, expected_status
):
    from reviews.models import ReviewDecision, ReviewItem

    context = samples_context
    context.field.batch = replace(context.field.batch, is_final_upload=True)
    capture = sample_capture(context)
    assert ingest(context.field, capture).status == "in_review"
    review = ReviewItem.objects.get(field_event_id=capture.id)
    context.field.profile.permission_codes = [
        code for code in context.field.profile.permission_codes if code != "sample.collect"
    ]
    context.field.profile.save(update_fields=["permission_codes"])
    client = APIClient()
    client.force_authenticate(context.actor.user)

    response = client.post(
        f"/api/v1/review-items/{review.pk}/{action}/",
        {
            "expected_revision": 0,
            "reason": "Require current collector permission before acceptance",
        },
        format="json",
    )

    assert response.status_code == expected_status, response.data
    if action == "accept":
        assert response.data["code"] == "review_blocked"
        assert not ReviewDecision.objects.filter(review_item=review).exists()
    else:
        assert ReviewDecision.objects.get(review_item=review).is_terminal
    assert not WolbachiaSample.objects.exists()
    assert not SampleReceipt.objects.exists()
    assert not WolbachiaResultAttempt.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_foreign_reading_lot_and_canonical_release_are_opaque(
    samples_context, org_b, make_member, monkeypatch, settings, tmp_path
):
    from lab.samples.services import resolve_source
    from tests.releases_support import accept_release, release_setup

    context = samples_context
    release_context = release_setup(
        context.actor.organization, make_member, monkeypatch, settings, tmp_path
    )
    released = accept_release(release_context)
    for kind, identifier in (
        ("reading", context.reading.pk),
        ("lot", release_context.lot.pk),
        ("release", released.pk),
    ):
        with pytest.raises(Http404):
            resolve_source(org_b, {"kind": kind, "id": identifier})
    assert not WolbachiaSample.objects.exists()


@pytest.mark.django_db
def test_sample_and_original_source_void_preserve_sample_reception_dependents(samples_context):
    context = samples_context
    sample, capture = collect(context)
    sample_command(context, sample, "receive")
    payload = {"reason_code": "other", "reason": "Retain genuine sample reception history"}
    correction = replace(
        envelope(context.field, "record.void"),
        payload=payload,
        payload_info=describe_payload(payload),
        voids_event_id=capture.id,
        device_time=context.clock["now"],
    )
    assert ingest(context.field, correction).code == "sample_void_blocked"
    assert FieldEvent.objects.get(pk=capture.id).voided_at is None
    assert SampleReceipt.objects.filter(sample=sample).exists()
    original_source = context.reading.event
    correction = replace(correction, id=uuid4(), voids_event_id=original_source.pk)
    source_verdict = ingest(context.field, correction)
    assert (source_verdict.status, source_verdict.code) == ("rejected", "sample_void_blocked")
    assert FieldEvent.objects.get(pk=original_source.pk).voided_at is None
    assert SampleReceipt.objects.filter(sample=sample).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("boundary", ["default_deny", "organization", "center", "quadrant"])
def test_sample_http_applies_default_deny_and_actual_paired_scope_before_disclosure(
    samples_context, make_member, org_b, boundary
):
    context = samples_context
    sample, _capture = collect(context)
    organization = org_b if boundary == "organization" else context.actor.organization
    codes = [] if boundary == "default_deny" else ["sample.read"]
    user, member = make_member(organization, codes)
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    if boundary in {"center", "quadrant"}:
        profile.scope[boundary + "s"] = {"mode": "selected", "ids": [str(uuid4())]}
    profile.save(update_fields=["scope"])
    client = APIClient()
    client.force_authenticate(user)
    detail = client.get(f"/api/v1/wolbachia-samples/{sample.pk}/")
    assert detail.status_code == (403 if boundary == "default_deny" else 404)
    listing = client.get("/api/v1/wolbachia-samples/", {"code": sample.code})
    if boundary == "default_deny":
        assert listing.status_code == 403
    else:
        assert listing.status_code == 200
        assert listing.data["count"] == 0
        assert listing.data["results"] == []


@pytest.mark.django_db(transaction=True)
def test_sample_command_contention_is_retryable_then_commits_one_result(samples_context):
    from lab.samples.services import SampleCommand, execute_sample_command

    context = samples_context
    sample, _capture = collect(context)
    sample_command(context, sample, "receive")
    request = SampleCommand("results", uuid4(), result_values(context, "valid", "negative"))
    entered, release = threading.Event(), threading.Event()

    def hold_organization():
        close_old_connections()
        try:
            with transaction.atomic():
                Organization.objects.select_for_update(no_key=True).get(
                    pk=context.actor.organization.pk
                )
                entered.set()
                assert release.wait(10)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        holder = pool.submit(hold_organization)
        try:
            assert entered.wait(10)
            with pytest.raises(LabInProgressError):
                execute_sample_command(context.actor, sample.pk, request)
            assert not sample.attempts.exists()
        finally:
            release.set()
        holder.result()
    first = execute_sample_command(context.actor, sample.pk, request)
    assert execute_sample_command(context.actor, sample.pk, request) == first
    assert WolbachiaResultAttempt.objects.count() == 1


@pytest.mark.django_db
def test_sample_audit_sql_cannot_rewrite_collection_receipt_or_result(samples_context):
    context = samples_context
    sample, _capture = collect(context)
    sample_command(context, sample, "receive")
    sample_command(context, sample, "results", **result_values(context, "valid", "positive"))
    rows = (
        sample,
        SampleReceipt.objects.get(),
        WolbachiaResultAttempt.objects.get(),
        sample.commands.first(),
    )
    for row in rows:
        table = sql.Identifier(row._meta.db_table)
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("UPDATE {} SET created_at=created_at WHERE id=%s").format(table), [row.pk]
            )
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(sql.SQL("DELETE FROM {} WHERE id=%s").format(table), [row.pk])


def test_sample_openapi_exposes_commands_without_organization_selector():
    from drf_spectacular.generators import SchemaGenerator

    schema = SchemaGenerator().get_schema(request=None, public=True)
    paths = schema["paths"]
    assert "/api/v1/wolbachia-samples/" in paths
    for action in ("receive", "results"):
        operation = paths[f"/api/v1/wolbachia-samples/{{id}}/{action}/"]["post"]
        assert "requestBody" in operation
        assert not any(
            parameter["name"] == "organization" for parameter in operation.get("parameters", [])
        )
