"""Decision policy, before any SQL writer: authority and dependency are different facts."""

from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from field_sync.envelope import EventEnvelope, describe_payload
from reviews.policies import (
    ReviewPolicyFacts,
    ShiftParentFacts,
    acceptance_blockers,
    shift_parent_state,
)
from reviews.source_identity import envelope_from_metadata, envelope_metadata, same_envelope

BASE = ReviewPolicyFacts(
    source_status="in_review",
    source_code="clock_skew",
    has_adapter=True,
    has_original_identity=True,
    has_historical_authority=True,
    allowed_observations=frozenset({"clock_skew", "final_upload_after_revoke"}),
)


@pytest.mark.parametrize(
    ("changes", "blocked"),
    [
        ({}, ()),
        ({"source_status": "rejected"}, ("source_rejected",)),
        ({"has_adapter": False}, ("handler_unavailable",)),
        ({"has_original_identity": False}, ("authority_history_unavailable",)),
        ({"has_historical_authority": False}, ("authority_history_unavailable",)),
        ({"source_code": "synthetic_unacknowledged_observation"}, ("observation_not_reviewable",)),
        ({"mandatory_blockers": ("original_evidence_required",)}, ("original_evidence_required",)),
        ({"source_code": "final_upload_after_revoke"}, ()),
    ],
)
def test_review_acknowledgement_never_supplies_missing_authority_or_mandatory_evidence(
    changes, blocked
):
    assert acceptance_blockers(replace(BASE, **changes)) == blocked


@pytest.mark.parametrize(
    ("changes", "expected"),
    [
        ({}, "pending"),
        ({"has_effective_open": True}, "effective"),
        ({"is_new_close": True, "has_current_close_authority": True}, "closure_only"),
        ({"is_new_close": True}, "blocked"),
        (
            {
                "is_new_close": True,
                "has_current_close_authority": True,
                "has_review_signal": True,
            },
            "pending",
        ),
        (
            {
                "materialization": "partial",
                "is_new_close": True,
                "has_current_close_authority": True,
            },
            "blocked",
        ),
        ({"materialization": "absent", "has_owned_parent": True}, "pending"),
        ({"materialization": "absent", "has_owned_parent": False}, "blocked"),
    ],
)
def test_only_a_separately_authorized_new_close_can_exit_an_unadopted_owned_frame(
    changes, expected
):
    facts = ShiftParentFacts(materialization="complete_owned", has_owned_parent=True)
    assert shift_parent_state(replace(facts, **changes)) == expected


def test_declared_void_identity_roundtrips_without_a_parent_row_and_ignores_request_position():
    payload = {"reason_code": "other", "reason": "Synthetic original correction"}
    original = EventEnvelope(
        index=0,
        id=uuid4(),
        type="record.void",
        schema_version=1,
        device_time=datetime(2026, 2, 4, 18, tzinfo=UTC),
        payload=payload,
        payload_info=describe_payload(payload),
        rules_version="synthetic-rules",
        catalog_version="synthetic-catalog",
        manual_capture=False,
        voids_event_id=uuid4(),
    )
    metadata = envelope_metadata(original)
    restored = envelope_from_metadata(metadata, payload)
    assert restored.voids_event_id == original.voids_event_id
    assert same_envelope(metadata, replace(original, index=12))
    assert not same_envelope(metadata, replace(original, voids_event_id=uuid4()))


def test_rule_values_and_version_ids_are_the_same_observation_retained_before_review_gate(
    monkeypatch,
):
    import json
    from decimal import Decimal
    from types import SimpleNamespace
    from unittest.mock import Mock

    from field_sync.envelope import GpsFix
    from field_sync.exceptions import EventNeedsReview
    from ovitraps.capture import capture_context

    selected_ids = {
        key: uuid4() for key in ("max_distance_to_point_m", "max_gps_accuracy_m", "speed_lock_kmh")
    }
    selected = [
        {
            "key": key,
            "value_type": "integer",
            "current_value": Decimal(value),
            "current_version_id": selected_ids[key],
        }
        for key, value in zip(selected_ids, (50, 50, 10), strict=True)
    ]
    parameters = Mock()
    parameters.values.return_value = selected
    monkeypatch.setattr("ovitraps.capture.list_parameters_with_current", lambda *_args: parameters)
    version = SimpleNamespace(pk=uuid4(), is_retired=False, location=[-99.99, 20.005])
    monkeypatch.setattr("ovitraps.capture.point_version_at", lambda *_args: version)
    monkeypatch.setattr("ovitraps.capture._speed_reference", lambda *_args: None)
    context = SimpleNamespace(
        organization=object(),
        review_authorization=None,
        observed_facts={},
        envelope=SimpleNamespace(
            device_time=datetime(2026, 11, 6, tzinfo=UTC), gps=GpsFix(20.005, -99.99, 5)
        ),
        review_code="clock_skew",
        acknowledges=lambda _code: False,
        rules_at=lambda _at: {"max_distance_to_point_m": 200},
    )
    with pytest.raises(EventNeedsReview):
        capture_context(context, SimpleNamespace(pk=uuid4()))
    captured = context.observed_facts["ovitrap"]
    assert captured["rules"]["max_distance_to_point_m"] == 50
    assert captured["rule_version_ids"] == {key: str(value) for key, value in selected_ids.items()}
    assert captured["point_version_id"] == str(version.pk)
    selected[0]["current_value"] = Decimal(200)
    assert captured["rules"]["max_distance_to_point_m"] == 50
    assert json.loads(json.dumps(captured)) == captured


@pytest.mark.parametrize(
    "case", ["government", "inactive_government", "legacy_identity", "current_changed"]
)
def test_historical_authority_uses_real_snapshot_identity_and_shared_government_clamp(
    monkeypatch, case
):
    from types import SimpleNamespace
    from unittest.mock import Mock

    from organizations.models import Organization, Profile, all_scope
    from organizations.services import _profile_snapshot
    from reviews.authority import historical_authority

    org = Organization(id=uuid4())
    custom = Profile(
        id=uuid4(),
        organization=org,
        slug="custom",
        permission_codes=["field_event.sync"],
        scope=all_scope(),
    )
    government = Profile(
        id=uuid4(),
        organization=org,
        slug="government",
        permission_codes=["portal.read", "field_event.sync"],
        scope=all_scope(),
        is_active=case != "inactive_government",
    )
    profiles = [custom] if case == "current_changed" else [custom, government]
    roles = {
        str(profile.pk): SimpleNamespace(pk=uuid4(), snapshot=_profile_snapshot(profile))
        for profile in profiles
    }
    if case == "legacy_identity":
        roles[str(custom.pk)].snapshot.pop("slug", None)
    if case == "current_changed":
        custom.permission_codes = []
        custom.scope = {
            "centers": {"mode": "none", "ids": []},
            "quadrants": {"mode": "none", "ids": []},
        }
        custom.slug = "government"
    member = SimpleNamespace(
        pk=uuid4(), snapshot={"is_active": True, "scope": all_scope(), "profiles": list(roles)}
    )

    def select(**filters):
        row = member if filters["kind"] == "membership" else roles.get(str(filters["target_id"]))
        return Mock(order_by=lambda *_args: SimpleNamespace(first=lambda: row))

    rows = SimpleNamespace(filter=select)
    monkeypatch.setattr(
        "reviews.authority.ConfigurationRevision.objects.filter", lambda **_kwargs: rows
    )
    proof = historical_authority(org, uuid4(), datetime(2026, 11, 6, tzinfo=UTC))
    if case == "legacy_identity":
        assert proof.unavailable == "authority_history_unavailable"
        assert not proof.scope.grants
    else:
        assert proof.unavailable is None
        assert proof.scope.allows("field_event.sync") is (case != "government")
        assert proof.scope.allows("portal.read") is (case == "government")


@pytest.mark.parametrize("event_type", ["ovitrap.place", "ovitrap.replace"])
def test_physical_parent_claim_and_batch_candidate_use_the_actual_new_identity(event_type):
    from reviews.dependencies import BatchCandidates, parent_claims

    original, replacement = uuid4(), uuid4()
    payload = {"ovitrap_id": str(original), "replacement_id": str(replacement)}
    capture = EventEnvelope(
        index=0,
        id=uuid4(),
        type=event_type,
        schema_version=1,
        device_time=datetime(2026, 11, 6, tzinfo=UTC),
        payload=payload,
        payload_info=describe_payload(payload),
        rules_version="original-rule-pin",
        catalog_version="original-catalog-pin",
        manual_capture=False,
    )
    identity = original if event_type == "ovitrap.place" else replacement
    batch = BatchCandidates.from_envelopes([capture])
    assert batch.parents == {("ovitrap", identity): (capture.id,)}
    assert parent_claims(capture, True) == ({"kind": "ovitrap", "identity": identity},)
    assert parent_claims(capture, False) == ()
    assert batch.captures[capture.id] is capture
    assert batch.envelopes[capture.id] == envelope_metadata(capture)
