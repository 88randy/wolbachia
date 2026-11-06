"""B-15 acceptance coverage; reuse B-14 authored history and sync helpers."""

from dataclasses import replace
from datetime import timedelta
from uuid import uuid4

import pytest

from tests.ovitrap_support import CAPTURED, envelope, ingest, setup_field


@pytest.fixture
def field(monkeypatch):
    from django.utils import timezone

    from tests.factories import RuleParameterFactory, RuleParameterVersionFactory

    monkeypatch.setattr(timezone, "now", lambda: CAPTURED)
    configured = setup_field()
    for key, value in {
        "clock_skew_review_seconds": 300,
        "closed_house_weeks_to_relocate": 2,
        "incidents_to_relocate": 3,
    }.items():
        parameter = RuleParameterFactory(organization=configured.batch.organization, key=key)
        RuleParameterVersionFactory(
            parameter=parameter, value=value, effective_from=CAPTURED - timedelta(days=30)
        )
    return configured


def lifecycle(field, kind, **overrides):
    payload = {
        "ovitrap_id": str(field.identity),
        "reason_code": "other",
        "other_text": "Physical condition observed",
        "evidence_ids": [str(uuid4())],
    }
    if kind == "replace":
        payload["replacement_id"] = str(uuid4())
    if kind == "relocate":
        payload["proposed_location"] = [-99.9901, 20.0051]
    if kind == "remove":
        payload["is_recovered"] = False
    payload.update(overrides.pop("payload", {}))
    if hasattr(field, "batch"):
        from tests.uploads_support import verified_upload

        for identifier in payload["evidence_ids"]:
            verified_upload(
                field.batch.organization,
                field.batch.user,
                device=field.batch.device,
                public_id=identifier,
            )
    sent = envelope(field, f"ovitrap.{kind}", **overrides)
    from field_sync.envelope import describe_payload

    return replace(sent, payload=payload, payload_info=describe_payload(payload))


@pytest.mark.parametrize("kind", ["replace", "relocate", "remove"])
def test_lifecycle_payload_rejects_organization_and_bounds_evidence(kind):
    from types import SimpleNamespace

    from ovitraps.lifecycle.serializers import PAYLOAD_SERIALIZERS

    sent = lifecycle(
        SimpleNamespace(
            identity=uuid4(), point=SimpleNamespace(pk=uuid4()), catalog_version="test"
        ),
        kind,
    )
    serializer = PAYLOAD_SERIALIZERS[kind](data={**sent.payload, "organization": str(uuid4())})
    assert not serializer.is_valid()
    assert serializer.errors["organization"][0].code == "unknown_field"
    serializer = PAYLOAD_SERIALIZERS[kind](
        data={**sent.payload, "evidence_ids": [str(uuid4())] * 101}
    )
    assert not serializer.is_valid()
    assert serializer.errors["evidence_ids"][0].code == "max_length"


@pytest.mark.parametrize(
    ("kind", "field_name"),
    [
        ("replace", "ovitrap_id"),
        ("replace", "replacement_id"),
        ("relocate", "ovitrap_id"),
        ("remove", "ovitrap_id"),
    ],
)
def test_lifecycle_refuses_numeric_uuid_that_cannot_round_trip_archived_history(kind, field_name):
    from types import SimpleNamespace

    from ovitraps.lifecycle.serializers import PAYLOAD_SERIALIZERS

    sent = lifecycle(
        SimpleNamespace(
            identity=uuid4(), point=SimpleNamespace(pk=uuid4()), catalog_version="test"
        ),
        kind,
    )
    serializer = PAYLOAD_SERIALIZERS[kind](data={**sent.payload, field_name: 1})
    assert not serializer.is_valid()
    assert serializer.errors[field_name][0].code == "invalid"


@pytest.mark.parametrize(
    "location", [[181, 20], [-99, 91], [float("nan"), 20], [0, float("inf")], [True, 20], [0]]
)
def test_proposal_refuses_unusable_location(location):
    from ovitraps.lifecycle.serializers import RelocatePayloadSerializer

    serializer = RelocatePayloadSerializer(
        data={
            "ovitrap_id": str(uuid4()),
            "reason_code": "other",
            "other_text": "Field observation",
            "evidence_ids": [],
            "proposed_location": location,
        }
    )
    assert not serializer.is_valid()
    assert serializer.errors["proposed_location"][0].code == "invalid_location"


@pytest.mark.django_db
def test_replacement_retains_point_code_lineage_and_fans_out_once(field):
    from field_sync.models import CourierChange
    from ovitraps.lifecycle.models import PhysicalOvitrapLineage
    from ovitraps.lifecycle.selectors import active_ovitraps
    from ovitraps.models import Ovitrap

    field.profile.permission_codes += ["field.bootstrap"]
    field.profile.save(update_fields=["permission_codes"])
    ingest(field, envelope(field))
    before = list(CourierChange.objects.values_list("resource_version", flat=True))
    sent = lifecycle(field, "replace")
    assert ingest(field, sent).status == ingest(field, sent).status == "accepted"
    lineage = PhysicalOvitrapLineage.objects.get()
    assert lineage.old_trap.client_uuid == field.identity
    assert str(lineage.new_trap.client_uuid) == sent.payload["replacement_id"]
    assert lineage.point_id == field.point.pk == lineage.new_trap.sampling_point_id
    assert lineage.new_trap.sampling_point.code == "P-111"
    assert Ovitrap.objects.count() == 2
    assert list(active_ovitraps(field.batch.organization).values_list("pk", flat=True)) == [
        lineage.new_trap_id
    ]
    changes = list(CourierChange.objects.order_by("sequence"))
    assert len(changes) == 3
    assert changes[1].resource_version not in before
    assert {row.resource_id for row in changes[1:]} == {
        str(field.identity),
        sent.payload["replacement_id"],
    }


@pytest.mark.django_db
def test_relocation_is_only_a_replayable_proposal_without_feed_or_geometry_change(field):
    from field_sync.models import CourierChange
    from geography.models import PointVersion
    from ovitraps.lifecycle.models import RelocationProposal

    ingest(field, envelope(field))
    original = list(PointVersion.objects.values("id", "location"))
    sent = lifecycle(field, "relocate")
    assert ingest(field, sent).status == ingest(field, sent).status == "accepted"
    proposal = RelocationProposal.objects.get()
    assert proposal.old_location == original[0]["location"]
    assert proposal.new_location == sent.payload["proposed_location"]
    assert proposal.event_id == sent.id
    assert list(PointVersion.objects.values("id", "location")) == original
    assert not CourierChange.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("recovered", [True, False])
def test_removal_recovery_retires_once_and_unrecovered_blocks_closure(field, recovered):
    from ovitraps.lifecycle.models import OvitrapIncidentLink, RemovalAttempt
    from ovitraps.lifecycle.selectors import active_ovitraps, has_unresolved_removal

    ingest(field, envelope(field))
    sent = lifecycle(field, "remove", payload={"is_recovered": recovered})
    assert ingest(field, sent).status == ingest(field, sent).status == "accepted"
    removal = RemovalAttempt.objects.get()
    assert removal.recovery_state == ("recovered" if recovered else "unrecovered")
    assert OvitrapIncidentLink.objects.count() == (0 if recovered else 1)
    assert has_unresolved_removal(field.batch.organization, point=field.point.pk) is not recovered
    assert (
        has_unresolved_removal(field.batch.organization, quadrant_id=field.point.block.quadrant_id)
        is not recovered
    )
    assert not active_ovitraps(field.batch.organization).exists()
    assert ingest(field, envelope(field, payload={"ovitrap_id": str(uuid4())})).status == "accepted"


@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["replace", "relocate", "remove"])
@pytest.mark.parametrize("blocker", ["gps", "evidence", "clock"])
def test_review_has_no_lifecycle_or_projection_effects(field, kind, blocker):
    from field_sync.models import CourierChange
    from ovitraps.lifecycle.models import (
        OvitrapIncidentLink,
        PhysicalOvitrapLineage,
        RelocationProposal,
        RemovalAttempt,
    )
    from ovitraps.models import Ovitrap

    ingest(field, envelope(field))
    overrides = {"gps": None} if blocker == "gps" else {}
    if blocker == "evidence":
        overrides["payload"] = {"evidence_ids": []}
    if blocker == "clock":
        field.batch = replace(field.batch, sent_at=CAPTURED - timedelta(hours=1))
    sent = lifecycle(field, kind, **overrides)
    result = ingest(field, sent)
    assert result.status == "in_review"
    assert (
        result.code
        == {
            "gps": "ovitrap_gps_unusable",
            "evidence": "ovitrap_evidence_required",
            "clock": "clock_skew",
        }[blocker]
    )
    assert Ovitrap.objects.count() == 1
    assert not any(
        model.objects.exists()
        for model in (
            PhysicalOvitrapLineage,
            RelocationProposal,
            RemovalAttempt,
            OvitrapIncidentLink,
            CourierChange,
        )
    )


@pytest.mark.parametrize(
    ("weeks", "incidents", "expected"),
    [
        (2, 3, (2, 3)),
        (1, 1, (1, 1)),
        (8, 10, (8, 10)),
        (0, 3, None),
        (9, 3, None),
        (2, 0, None),
        (2, 11, None),
        (1.5, 3, None),
        (None, 3, None),
    ],
)
def test_historical_advisory_thresholds_use_op03_bounds(weeks, incidents, expected):
    from ovitraps.lifecycle.selectors import relocation_thresholds

    assert (
        relocation_thresholds(
            {"closed_house_weeks_to_relocate": weeks, "incidents_to_relocate": incidents}
        )
        == expected
    )


@pytest.mark.django_db
def test_other_reason_uses_exact_archived_catalog_without_overwriting_evidence(field):
    from catalogs.models import CatalogItem
    from ovitraps.lifecycle.models import RelocationProposal

    ingest(field, envelope(field))
    item = CatalogItem.objects.get(
        organization=field.batch.organization, catalog__slug="relocation-reason", code="other"
    )
    original_label = item.label_es
    CatalogItem.objects.filter(pk=item.pk).update(label_es="Label changed after download")
    invalid = lifecycle(field, "relocate", payload={"other_text": ""})
    result = ingest(field, invalid)
    assert result.code == "invalid_payload"
    assert result.params["fields"] == {"other_text": ["required_for_other"]}
    assert not RelocationProposal.objects.exists()
    sent = lifecycle(field, "relocate")
    assert ingest(field, sent).status == "accepted"
    proposal = RelocationProposal.objects.get()
    assert proposal.reason_label["es-MX"] == original_label
    assert proposal.evidence_ids == sent.payload["evidence_ids"]
    assert proposal.rule_version_ids["closed_house_weeks_to_relocate"]


@pytest.mark.django_db
@pytest.mark.parametrize("finding", ["abandoned", "removed"])
def test_abandoned_or_removed_findings_link_one_incident_through_removal(field, finding):
    from ovitraps.lifecycle.models import OvitrapIncidentLink, RemovalAttempt

    ingest(field, envelope(field))
    checked = envelope(
        field,
        "ovitrap.check",
        payload={
            "finding": finding,
            "paddle_present": False,
            "has_eggs": None,
            "paddle_type": None,
            "bag_code": None,
        },
    )
    assert ingest(field, checked).status == ingest(field, checked).status == "accepted"
    marker = OvitrapIncidentLink.objects.get()
    assert marker.event_id == checked.id
    from ovitraps.models import OvitrapReading
    from ovitraps.serializers import ReadingSerializer

    assert ReadingSerializer(OvitrapReading.objects.get()).data["incident_link"] == str(marker.pk)
    removal = lifecycle(field, "remove")
    assert ingest(field, removal).status == "accepted"
    assert OvitrapIncidentLink.objects.count() == 1
    assert RemovalAttempt.objects.get().incident_link_id == marker.pk


@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["replace", "relocate", "remove"])
def test_foreign_unknown_and_ungranted_physical_identity_share_one_rejection(field, kind):
    from types import SimpleNamespace

    from field_sync.services import sync_batch
    from organizations.models import all_scope

    foreign = setup_field()
    ingest(foreign, envelope(foreign))
    results = [
        ingest(field, lifecycle(field, kind, payload={"ovitrap_id": str(identifier)}))
        for identifier in (foreign.identity, uuid4())
    ]
    ingest(field, envelope(field))
    pending_field = SimpleNamespace(**{**vars(field), "identity": uuid4()})
    assert ingest(pending_field, envelope(pending_field, gps=None)).status == "in_review"
    field.membership.scope = {**all_scope(), "quadrants": {"mode": "none", "ids": []}}
    field.membership.save(update_fields=["scope"])
    results.append(ingest(field, lifecycle(field, kind)))
    results.append(ingest(pending_field, lifecycle(pending_field, kind)))
    raw_field = SimpleNamespace(**{**vars(field), "identity": uuid4()})
    parent = replace(
        envelope(raw_field, gps=None), index=1, device_time=CAPTURED + timedelta(seconds=1)
    )
    child = lifecycle(raw_field, kind)
    results.append(sync_batch(field.batch, [child, parent], None).results[0])
    assert {(row.status, row.code, str(row.params)) for row in results} == {
        ("rejected", "ovitrap_inaccessible", "{}")
    }


@pytest.mark.django_db
@pytest.mark.parametrize("final_upload", [False, True])
def test_replacement_and_removal_stale_identity_review_without_second_effect(field, final_upload):
    from field_sync.services import sync_batch
    from ovitraps.lifecycle.models import PhysicalOvitrapLineage, RemovalAttempt
    from ovitraps.models import Ovitrap
    from reviews.models import ReviewParentClaim, ReviewSourceSnapshot

    placed = envelope(field)
    assert ingest(field, placed).status == "accepted"
    original_claim = ReviewParentClaim.objects.get(
        organization=field.batch.organization, kind="ovitrap", identity=field.identity
    )
    sent = lifecycle(field, "replace")
    assert ingest(field, sent).status == "accepted"
    for kind in ("replace", "relocate", "remove"):
        result = ingest(field, lifecycle(field, kind))
        assert (result.status, result.code) == ("in_review", "ovitrap_stale_identity")
    field.identity = sent.payload["replacement_id"]
    reused = lifecycle(field, "replace", payload={"replacement_id": sent.payload["ovitrap_id"]})
    batch = replace(field.batch, is_final_upload=final_upload)
    result = sync_batch(batch, [reused], None).results[0]
    assert result.status == "in_review"
    assert result.code == (
        "final_upload_after_revoke" if final_upload else "ovitrap_stale_identity"
    )
    snapshot = ReviewSourceSnapshot.objects.get(source_event_id=reused.id)
    assert "ovitrap_stale_identity" in snapshot.facts["observed_codes"]
    assert sync_batch(batch, [reused], None).results[0] == result
    retained = ReviewParentClaim.objects.get(pk=original_claim.pk)
    assert retained.source_event_id == placed.id
    assert retained.identity == original_claim.identity
    assert (
        ReviewParentClaim.objects.filter(
            organization=field.batch.organization, kind="ovitrap", identity=retained.identity
        ).count()
        == 1
    )
    assert not ReviewParentClaim.objects.filter(source_event_id=reused.id).exists()
    assert Ovitrap.objects.count() == 2
    assert PhysicalOvitrapLineage.objects.count() == 1
    assert not RemovalAttempt.objects.exists()


def void_event(field, source, **overrides):
    sent = envelope(field, "record.void", voids_event_id=source.id)
    from field_sync.envelope import describe_payload

    payload = {"reason_code": "other", "reason": "Correction of field lifecycle", **overrides}
    return replace(sent, payload=payload, payload_info=describe_payload(payload))


@pytest.mark.django_db
def test_void_replacement_restores_old_identity_without_mutating_source_or_lineage(field):
    from field_sync.models import FieldEvent
    from ovitraps.lifecycle.models import PhysicalOvitrapLineage
    from ovitraps.lifecycle.selectors import active_ovitraps
    from ovitraps.models import OvitrapVoid

    ingest(field, envelope(field))
    sent = lifecycle(field, "replace")
    assert ingest(field, sent).status == "accepted"
    assert ingest(field, void_event(field, sent, reason=" too short ")).code == "invalid_payload"
    assert ingest(field, void_event(field, sent)).status == "accepted"
    assert list(
        active_ovitraps(field.batch.organization).values_list("client_uuid", flat=True)
    ) == [field.identity]
    source = FieldEvent.objects.get(pk=sent.id)
    assert source.status == "accepted"
    assert source.payload == sent.payload
    assert PhysicalOvitrapLineage.objects.get().evidence_ids == sent.payload["evidence_ids"]
    assert OvitrapVoid.objects.get(target_event=source).event.type == "record.void"


@pytest.mark.django_db
@pytest.mark.parametrize("dependent", ["reading", "replacement", "decision", "placement"])
def test_void_dependency_gates_preserve_source_and_compensation_boundary(field, dependent):
    from field_sync.models import FieldEvent
    from ovitraps.lifecycle.models import RelocationDecision, RelocationProposal
    from ovitraps.models import OvitrapVoid

    ingest(field, envelope(field))
    kind = (
        "relocate"
        if dependent == "decision"
        else ("remove" if dependent == "placement" else "replace")
    )
    sent = lifecycle(field, kind)
    assert ingest(field, sent).status == "accepted"
    if dependent == "decision":
        RelocationDecision.objects.create(
            organization=field.batch.organization,
            created_by=field.batch.user,
            event=FieldEvent.objects.get(pk=sent.id),
            proposal=RelocationProposal.objects.get(),
            decision="approved",
        )
    elif dependent == "placement":
        assert (
            ingest(field, envelope(field, payload={"ovitrap_id": str(uuid4())})).status
            == "accepted"
        )
    else:
        field.identity = sent.payload["replacement_id"]
        following = (
            envelope(field, "ovitrap.check")
            if dependent == "reading"
            else lifecycle(field, "replace")
        )
        assert ingest(field, following).status == "accepted"
    blocked = ingest(field, void_event(field, sent))
    assert blocked.code == "ovitrap_void_blocked"
    assert {row["resource"] for row in blocked.params["blocked_by"]} == {
        "ovitrap"
        if dependent == "placement"
        else ("relocation_decision" if dependent == "decision" else dependent)
    }
    source = FieldEvent.objects.get(pk=sent.id)
    assert source.voided_at is None
    assert source.payload == sent.payload
    assert source.status == "accepted"
    assert not OvitrapVoid.objects.exists()


@pytest.mark.django_db
def test_foreign_author_and_scope_loss_voids_never_expose_dependencies(field):
    from field_sync.services import sync_batch
    from organizations.models import all_scope
    from tests.ovitrap_support import second_courier

    ingest(field, envelope(field))
    sent = lifecycle(field, "replace")
    ingest(field, sent)
    other = second_courier(field)
    result = sync_batch(other, [void_event(field, sent)], None).results[0]
    assert result.code == "void_target_not_owned"
    field.membership.scope = {**all_scope(), "centers": {"mode": "none", "ids": []}}
    field.membership.save(update_fields=["scope"])
    result = ingest(field, void_event(field, sent))
    assert result.code == "ovitrap_inaccessible"
    assert "blocked_by" not in result.params


@pytest.mark.django_db
def test_closed_house_suggestion_uses_latest_epi_weeks_and_is_advisory(field):
    from ovitraps.lifecycle.selectors import suggest_relocation
    from ovitraps.models import Ovitrap

    ingest(field, envelope(field))
    trap = Ovitrap.objects.get()
    assert not suggest_relocation(trap, CAPTURED)
    for offset in (0, 7):
        instant = CAPTURED + timedelta(days=offset)
        field.batch = replace(field.batch, sent_at=instant, received_at=instant)
        sent = envelope(
            field,
            "ovitrap.check",
            device_time=instant,
            payload={
                "finding": "closed-house",
                "paddle_present": False,
                "has_eggs": None,
                "paddle_type": None,
                "bag_code": None,
            },
        )
        assert ingest(field, sent).status == "accepted"
    assert suggest_relocation(trap, CAPTURED + timedelta(days=7))
    assert not suggest_relocation(trap, CAPTURED + timedelta(days=21))
    assert (
        ingest(field, lifecycle(field, "relocate", device_time=CAPTURED + timedelta(days=7))).status
        == "accepted"
    )


@pytest.mark.django_db
def test_incident_threshold_counts_fixed_point_across_physical_replacements(field):
    from ovitraps.lifecycle.selectors import suggest_relocation
    from ovitraps.models import Ovitrap

    ingest(field, envelope(field))
    for index in range(3):
        checked = envelope(
            field,
            "ovitrap.check",
            payload={
                "finding": "abandoned",
                "paddle_present": False,
                "has_eggs": None,
                "paddle_type": None,
                "bag_code": None,
            },
        )
        assert ingest(field, checked).status == "accepted"
        trap = Ovitrap.objects.get(
            organization=field.batch.organization, client_uuid=field.identity
        )
        assert suggest_relocation(trap, CAPTURED) is (index == 2)
        if index < 2:
            sent = lifecycle(field, "replace")
            assert ingest(field, sent).status == "accepted"
            field.identity = sent.payload["replacement_id"]


@pytest.mark.django_db
def test_removal_feed_changes_revision_and_void_restores_closure_gate(field):
    from field_sync.models import CourierChange
    from ovitraps.lifecycle.selectors import has_unresolved_removal

    field.profile.permission_codes += ["field.bootstrap"]
    field.profile.save(update_fields=["permission_codes"])
    ingest(field, envelope(field))
    previous = CourierChange.objects.get()
    sent = lifecycle(field, "remove")
    assert ingest(field, sent).status == ingest(field, sent).status == "accepted"
    changes = list(CourierChange.objects.order_by("sequence"))
    assert len(changes) == 2
    assert changes[-1].payload["is_retired"] is True
    assert changes[-1].resource_version != previous.resource_version
    assert has_unresolved_removal(field.batch.organization, point=field.point.pk)
    assert ingest(field, void_event(field, sent)).status == "accepted"
    assert not has_unresolved_removal(field.batch.organization, point=field.point.pk)
    assert CourierChange.objects.order_by("-sequence").first().payload["is_retired"] is False


@pytest.mark.django_db
def test_new_endpoints_default_deny_and_isolate_org_center_quadrant(field, api_client):
    from geography.models import Quadrant
    from organizations.models import Center, all_scope
    from ovitraps.lifecycle.models import RelocationProposal
    from tests.factories import MembershipFactory

    field.profile.permission_codes += ["relocation.read"]
    field.profile.save(update_fields=["permission_codes"])
    ingest(field, envelope(field))
    ingest(field, envelope(field, "ovitrap.check"))
    proposed = lifecycle(field, "relocate", payload={"ovitrap_id": field.identity.hex.upper()})
    ingest(field, proposed)
    proposal = RelocationProposal.objects.get()
    history_url = f"/api/v1/ovitraps/{field.identity}/history/"
    relocations_url = "/api/v1/relocations/"
    denied = MembershipFactory(organization=field.batch.organization, scope=all_scope())
    api_client.force_authenticate(denied.user)
    assert (
        api_client.get(history_url).status_code
        == api_client.get(relocations_url).status_code
        == 403
    )
    api_client.force_authenticate(field.batch.user)
    response = api_client.get(
        relocations_url,
        {
            "code": str(proposal.pk),
            "point": str(field.point.pk),
            "ovitrap": str(field.identity),
            "status": "pending",
            "ordering": "created_at",
        },
    )
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["status"] == "pending"
    history = api_client.get(history_url)
    assert history.status_code == 200
    assert {row["type"] for row in history.data["entries"]} == {"ovitrap.place", "ovitrap.relocate"}
    assert all(
        row["point_code"] == "P-111"
        and row["author"] == str(field.batch.user.pk)
        and row["server_received_at"]
        and row["device_time"]
        for row in history.data["entries"]
    )
    foreign = setup_field()
    foreign.profile.permission_codes += ["relocation.read"]
    foreign.profile.save(update_fields=["permission_codes"])
    api_client.force_authenticate(foreign.batch.user)
    assert api_client.get(history_url).status_code == 404
    assert api_client.get(relocations_url, {"code": str(proposal.pk)}).data["count"] == 0
    assert api_client.get(relocations_url, {"point": str(field.point.pk)}).status_code == 404
    assert api_client.get(relocations_url, {"ovitrap": str(field.identity)}).status_code == 404
    api_client.force_authenticate(field.batch.user)
    center = Center.objects.create(
        organization=field.batch.organization, code="other", name="Other"
    )
    quadrant = Quadrant.objects.create(
        organization=field.batch.organization,
        center=field.point.block.quadrant.center,
        code="other",
    )
    for scope in (
        {**all_scope(), "centers": {"mode": "selected", "ids": [str(center.pk)]}},
        {**all_scope(), "quadrants": {"mode": "selected", "ids": [str(quadrant.pk)]}},
        {**all_scope(), "quadrants": {"mode": "selected", "ids": []}},
    ):
        field.membership.scope = scope
        field.membership.save(update_fields=["scope"])
        assert api_client.get(history_url).status_code == 404
        assert api_client.get(relocations_url).data["count"] == 0
        assert api_client.get(relocations_url, {"point": str(field.point.pk)}).status_code == 404
    field.membership.scope = all_scope()
    field.membership.save(update_fields=["scope"])
    replacement = lifecycle(field, "replace")
    assert ingest(field, replacement).status == "accepted"
    found = api_client.get("/api/v1/ovitraps/", {"code": str(field.identity)})
    assert found.data["count"] == 1
    assert found.data["results"][0]["is_retired"]
    assert api_client.get(history_url).status_code == 200
    assert ingest(field, void_event(field, proposed)).status == "accepted"
    assert api_client.get(relocations_url).data["count"] == 0
    assert api_client.get(relocations_url, {"include_voided": "true"}).data["count"] == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("kind", ["replace", "relocate", "remove"])
def test_barrier_replay_never_duplicates_lifecycle_rows(field, kind):
    from field_sync.exceptions import SyncInProgressError
    from ovitraps.lifecycle.models import PhysicalOvitrapLineage, RelocationProposal, RemovalAttempt
    from tests.sync_support import run_in_threads

    ingest(field, envelope(field))
    sent = lifecycle(field, kind)
    outcomes = run_in_threads(lambda: ingest(field, sent), lambda: ingest(field, sent))
    for index, result in enumerate(outcomes):
        if isinstance(result, SyncInProgressError):
            outcomes[index] = ingest(field, sent)
    assert not any(isinstance(result, Exception) for result in outcomes), outcomes
    assert {row.status for row in outcomes} == {"accepted"}
    assert {
        "replace": PhysicalOvitrapLineage,
        "relocate": RelocationProposal,
        "remove": RemovalAttempt,
    }[kind].objects.count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("kind", ["replace", "relocate", "remove"])
def test_new_handler_lock_contention_is_retryable_429_without_partial_effects(field, kind):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    from django.db import connection, transaction

    from field_sync.models import CourierChange, FieldEvent
    from field_sync.services import lock_courier_batches
    from ovitraps.lifecycle.models import PhysicalOvitrapLineage, RelocationProposal, RemovalAttempt
    from tests.ovitrap_support import second_courier
    from tests.sync_support import event
    from tests.test_bundle_producers_196 import phone_for

    field.profile.permission_codes += ["field.bootstrap"]
    field.profile.save(update_fields=["permission_codes"])
    ingest(field, envelope(field))
    other = second_courier(field)
    phone = phone_for(field.batch)
    pending = lifecycle(field, kind)
    sent = event(
        id=str(pending.id),
        type=pending.type,
        payload=pending.payload,
        device_time=CAPTURED.isoformat(),
        catalog_version=field.catalog_version,
        gps={"lat": 20.005, "lng": -99.99, "accuracy_m": 5},
    )
    baseline = CourierChange.objects.count()
    locked, release = threading.Event(), threading.Event()

    def hold_lock():
        try:
            with transaction.atomic():
                lock_courier_batches(field.batch if kind == "relocate" else other)
                locked.set()
                assert release.wait(timeout=15), "test did not release held courier lock"
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        holder = pool.submit(hold_lock)
        try:
            assert locked.wait(timeout=10), "courier lock was not acquired"
            response = phone.sync([sent], sent_at=CAPTURED.isoformat())
        finally:
            release.set()
            holder.result(timeout=15)
    assert (response.status_code, response.data["code"]) == (429, "sync_in_progress")
    assert response["Retry-After"]
    assert not FieldEvent.objects.filter(pk=pending.id).exists()
    assert CourierChange.objects.count() == baseline
    assert not any(
        model.objects.exists()
        for model in (PhysicalOvitrapLineage, RelocationProposal, RemovalAttempt)
    )
