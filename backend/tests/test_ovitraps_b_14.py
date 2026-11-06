"""B-14 behavior coverage; acceptance mapping lives in ovitraps/README.md."""

from uuid import uuid4

import pytest

from ovitraps.payloads import CheckPayloadSerializer, PlacePayloadSerializer
from ovitraps.qr import parse_qr


def check_payload(**overrides):
    return {
        "ovitrap_id": str(uuid4()),
        "finding": "intact",
        "paddle_present": True,
        "has_eggs": True,
        "temperature_c": 24,
        "humidity_pct": 70,
        "paddle_type": "standard",
        "is_lagged": False,
        "bag_code": "B-111",
        **overrides,
    }


@pytest.mark.parametrize(
    ("present", "eggs", "valid"),
    [
        (True, True, True),
        (True, False, True),
        (False, None, True),
        (False, False, False),
        (False, True, False),
        (True, None, False),
        (True, 1, False),
        ("true", True, False),
    ],
)
def test_payload_accepts_only_conditional_boolean_eggs(present, eggs, valid):
    payload = CheckPayloadSerializer(data=check_payload(paddle_present=present, has_eggs=eggs))
    assert payload.is_valid() is valid, payload.errors


@pytest.mark.parametrize(
    "key", ["egg_count", "eggs", "count", "numeric_egg_count", "organization_id"]
)
def test_payload_refuses_every_unrecognized_key_including_courier_counts(key):
    payload = CheckPayloadSerializer(data=check_payload(**{key: 12}))
    assert not payload.is_valid()
    assert payload.errors[key][0].code == "unknown_field"


@pytest.mark.parametrize(
    ("refs", "valid"),
    [([], True), ([str(uuid4())], True), (["stock-1"], False), ([str(uuid4())] * 101, False)],
)
def test_placement_bounds_opaque_uuid_references(refs, valid):
    payload = PlacePayloadSerializer(
        data={
            "sampling_point_id": str(uuid4()),
            "ovitrap_id": str(uuid4()),
            "supply_refs": refs,
            "evidence_ids": refs,
        }
    )
    assert payload.is_valid() is valid, payload.errors


@pytest.mark.parametrize("kind", ["lot", "ovitrap", "bag", "release-device", "sample"])
def test_qr_preserves_kind_and_physical_identity(kind):
    identity = uuid4()
    assert parse_qr(f"wbf:1:{kind}:{identity}") == (kind, identity)


@pytest.mark.parametrize(
    "text",
    [
        "wbf:2:bag:00000000-0000-0000-0000-000000000001",
        "wbf:1:trap:00000000-0000-0000-0000-000000000001",
        " wbf:1:bag:bad",
        "wbf:1:bag:\uff11\uff12",
        "B-111",
        "wbf:1:bag:00000000000000000000000000000001",
    ],
)
def test_qr_refuses_ambiguous_identity_and_requires_explicit_manual_fallback(text):
    with pytest.raises(ValueError, match="QR"):
        parse_qr(text)


@pytest.mark.parametrize(
    ("choice", "text", "valid"),
    [
        ("other", "Broken attachment", True),
        ("other", "", False),
        ("other", "   ", False),
        ("intact", "", True),
        ("intact", "unrelated", False),
    ],
)
def test_other_text_is_required_only_for_other(choice, text, valid):
    from field_sync.exceptions import EventRejected
    from ovitraps.findings import validate_other_text

    item = {"code": choice, "is_other": choice == "other"}
    payload = {"other_text": text}
    if valid:
        validate_other_text(payload, (item, None))
    else:
        with pytest.raises(EventRejected) as rejected:
            validate_other_text(payload, (item, None))
        assert rejected.value.params["fields"]["other_text"]


@pytest.mark.parametrize("finding", ["closed-house", "absent", "missing", "destroyed"])
def test_unavailable_house_or_ovitrap_skips_egg_question(finding):
    invalid = CheckPayloadSerializer(data=check_payload(finding=finding))
    assert not invalid.is_valid()
    assert invalid.errors["paddle_present"][0].code == "finding_without_paddle"
    valid = CheckPayloadSerializer(
        data=check_payload(finding=finding, paddle_present=False, has_eggs=None)
    )
    assert valid.is_valid(), valid.errors


@pytest.fixture
def field():
    from tests.ovitrap_support import setup_field

    return setup_field()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"gps": None}, "ovitrap_gps_unusable"),
        ({"accuracy": None}, "ovitrap_gps_unusable"),
        ({"accuracy": 0}, "ovitrap_gps_unusable"),
        ({"accuracy": 51}, "ovitrap_gps_unusable"),
        ({"longitude": -99.98}, "ovitrap_too_far"),
        ({"missing_rules": True}, "ovitrap_rules_unavailable"),
        ({"review": "clock_skew"}, "clock_skew"),
    ],
)
def test_review_capture_creates_no_operational_effects(field, overrides, expected, monkeypatch):
    from dataclasses import replace

    from field_sync.envelope import GpsFix
    from ovitraps.models import Bag, Ovitrap, OvitrapReading, PlacementAttempt
    from tests.ovitrap_support import envelope, ingest

    sent = envelope(field)
    if "gps" in overrides:
        sent = replace(sent, gps=overrides["gps"])
    if "accuracy" in overrides or "longitude" in overrides:
        sent = replace(
            sent,
            gps=GpsFix(20.005, overrides.get("longitude", -99.99), overrides.get("accuracy", 5)),
        )
    if overrides.get("missing_rules"):
        monkeypatch.setattr("ovitraps.capture.rule_snapshot", lambda ctx: ({}, {}))
    if overrides.get("review"):
        field.batch = replace(field.batch, is_final_upload=True)
        expected = "final_upload_after_revoke"
    result = ingest(field, sent)
    assert (result.status, result.code) == ("in_review", expected)
    assert all(
        not model.objects.exists() for model in (Ovitrap, PlacementAttempt, OvitrapReading, Bag)
    )


@pytest.mark.django_db
def test_historical_location_and_rules_are_used_at_capture_and_retained(field):
    from datetime import timedelta

    from geography.models import PointVersion
    from ovitraps.models import PlacementAttempt
    from rules.models import RuleParameter
    from tests.factories import RuleParameterVersionFactory
    from tests.ovitrap_support import CAPTURED, envelope, ingest

    parameter = RuleParameter.objects.get(
        organization=field.batch.organization, key="max_distance_to_point_m"
    )
    historical = parameter.versions.get()
    RuleParameterVersionFactory(
        parameter=parameter, value=10, effective_from=CAPTURED + timedelta(days=1)
    )
    PointVersion.objects.create(
        organization=field.batch.organization,
        point=field.point,
        version=2,
        location=[-98, 20],
        effective_from=CAPTURED + timedelta(days=1),
    )
    from field_sync.envelope import GpsFix

    sent = envelope(
        field,
        gps=GpsFix(20.005, -99.9903, 5),
        payload={"supply_refs": [str(uuid4())], "evidence_ids": [str(uuid4())]},
    )
    assert ingest(field, sent).status == "accepted"
    placement = PlacementAttempt.objects.get(event_id=sent.id)
    assert placement.evaluated_rules["max_distance_to_point_m"] == 50
    assert placement.rule_version_ids["max_distance_to_point_m"] == str(historical.pk)
    assert placement.ovitrap.point_version.version == 1
    assert placement.supply_refs == sent.payload["supply_refs"]
    assert placement.evidence_ids == sent.payload["evidence_ids"]
    assert placement.event.catalog_version == sent.catalog_version


@pytest.mark.django_db
def test_lagged_check_repeat_void_and_correction_preserve_lab_provenance(field):
    from ovitraps.models import Bag, OvitrapReading, OvitrapVoid
    from ovitraps.serializers import ReadingSerializer
    from tests.ovitrap_support import envelope, ingest

    assert ingest(field, envelope(field)).status == "accepted"
    sent = envelope(field, "ovitrap.check", payload={"is_lagged": True})
    assert ingest(field, sent).status == "accepted"
    assert ingest(field, sent).status == "accepted"
    assert (OvitrapReading.objects.count(), Bag.objects.count()) == (1, 1)
    reading = OvitrapReading.objects.get(event_id=sent.id)
    projection = ReadingSerializer(reading).data
    assert projection["is_countable"]
    assert projection["is_index_excluded"]
    assert projection["index_exclusion_reason"] == "lagged"
    repeated = ingest(field, envelope(field, "ovitrap.check", payload={"bag_code": "B-repeat"}))
    assert repeated.code == "ovitrap_reading_exists"
    void = envelope(
        field,
        "record.void",
        voids_event_id=sent.id,
        payload={"reason_code": "other", "reason": "  Corrected field observation  "},
    )
    assert ingest(field, void).status == "accepted"
    corrected = envelope(field, "ovitrap.check", payload={"bag_code": "B-corrected"})
    assert ingest(field, corrected).status == "accepted"
    reading.event.refresh_from_db()
    assert reading.event.status == "accepted"
    assert OvitrapVoid.objects.get(target_event_id=sent.id).reason == "Corrected field observation"
    assert OvitrapReading.objects.count() == Bag.objects.count() == 2
    assert not ReadingSerializer(reading).data["is_countable"]
    assert Bag.objects.get(code="B-111").event.voided_at is not None


@pytest.mark.django_db
def test_closed_house_reading_keeps_history_without_a_bag(field):
    finding = "closed-house"
    from ovitraps.models import Bag, OvitrapReading
    from tests.ovitrap_support import envelope, ingest

    ingest(field, envelope(field))
    result = ingest(
        field,
        envelope(
            field,
            "ovitrap.check",
            payload={
                "finding": finding,
                "paddle_present": False,
                "has_eggs": None,
                "paddle_type": None,
                "bag_code": None,
            },
        ),
    )
    assert result.status == "accepted"
    assert OvitrapReading.objects.get().has_eggs is None
    assert not Bag.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("choice", "expected"),
    [
        ("intact", "ovitrap_catalog_item_deactivated"),
        ("late-added", "ovitrap_catalog_item_unknown"),
    ],
)
def test_old_catalog_token_resolves_retained_deactivated_choice_without_effects(
    field, choice, expected
):
    from catalogs.models import CatalogItem
    from ovitraps.models import OvitrapReading
    from tests.ovitrap_support import envelope, ingest

    ingest(field, envelope(field))
    CatalogItem.objects.filter(
        organization=field.batch.organization, catalog__slug="ovitrap-finding", code="intact"
    ).update(is_active=False)
    # Existing on the server but absent from the submitted archive is still unknown.
    from tests.factories import CatalogItemFactory

    catalog = CatalogItem.objects.get(
        organization=field.batch.organization, catalog__slug="ovitrap-finding", code="intact"
    ).catalog
    CatalogItemFactory(catalog=catalog, code="late-added")
    sent = envelope(field, "ovitrap.check", payload={"finding": choice})
    result = ingest(field, sent)
    assert result.code == expected
    assert result.status == ("in_review" if choice == "intact" else "rejected")
    assert not OvitrapReading.objects.exists()


@pytest.mark.django_db
def test_foreign_assignment_and_unknown_point_have_identical_results(field):
    from organizations.models import all_scope
    from tests.ovitrap_support import envelope, ingest

    field.membership.scope = {**all_scope(), "quadrants": {"mode": "none", "ids": []}}
    field.membership.save(update_fields=["scope"])
    inaccessible = ingest(field, envelope(field))
    missing = ingest(field, envelope(field, payload={"sampling_point_id": str(uuid4())}))
    assert (inaccessible.status, inaccessible.code, inaccessible.params) == (
        missing.status,
        missing.code,
        missing.params,
    )
    assert inaccessible.code == "ovitrap_point_inaccessible"


@pytest.mark.django_db
def test_place_void_with_existing_reading_returns_safe_blocker_and_rolls_back(field):
    from field_sync.models import FieldEvent
    from ovitraps.models import OvitrapReading, OvitrapVoid
    from tests.ovitrap_support import envelope, ingest

    placed = envelope(field)
    ingest(field, placed)
    ingest(field, envelope(field, "ovitrap.check"))
    result = ingest(
        field,
        envelope(
            field,
            "record.void",
            voids_event_id=placed.id,
            payload={"reason_code": "other", "reason": "Correct the placement location"},
        ),
    )
    assert result.code == "ovitrap_void_blocked"
    assert result.params["blocked_by"] == [
        {"resource": "reading", "id": str(OvitrapReading.objects.get().pk)}
    ]
    assert FieldEvent.objects.get(pk=placed.id).voided_at is None
    assert not OvitrapVoid.objects.exists()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("race", ["replay", "week", "bag"])
def test_barrier_races_never_duplicate_reading_or_bag(field, race):
    from types import SimpleNamespace

    from field_sync.exceptions import SyncInProgressError
    from field_sync.services import sync_batch
    from ovitraps.models import Bag, OvitrapReading
    from tests.ovitrap_support import envelope, ingest, make_point, second_courier
    from tests.sync_support import run_in_threads

    ingest(field, envelope(field))
    sent = envelope(field, "ovitrap.check")
    other = field
    other_batch = field.batch
    if race != "replay":
        other_batch = second_courier(field)
    if race == "bag":
        other = SimpleNamespace(
            **{
                **vars(field),
                "point": make_point(field.point.block.quadrant, "P-second"),
                "identity": uuid4(),
                "batch": other_batch,
            }
        )
        ingest(other, envelope(other))
    competing = (
        sent
        if race == "replay"
        else envelope(
            other, "ovitrap.check", payload={"bag_code": "B-111" if race == "bag" else "B-second"}
        )
    )
    jobs = [(field.batch, sent), (other_batch, competing)]

    def run(job):
        return sync_batch(job[0], [job[1]], None).results[0]

    results = run_in_threads(lambda: run(jobs[0]), lambda: run(jobs[1]))
    for index, result in enumerate(results):
        if isinstance(result, SyncInProgressError):
            results[index] = run(jobs[index])
    assert not any(isinstance(result, Exception) for result in results), results
    expected = (
        {"accepted"}
        if race == "replay"
        else {"accepted", "ovitrap_bag_code_used" if race == "bag" else "ovitrap_reading_exists"}
    )
    assert {result.code for result in results} == expected
    assert OvitrapReading.objects.count() == Bag.objects.count() == 1


@pytest.mark.django_db
def test_read_endpoints_enforce_default_deny_and_org_center_quadrant_isolation(field, api_client):
    from geography.models import Quadrant
    from organizations.models import Center, all_scope
    from ovitraps.models import Bag, Ovitrap, OvitrapReading
    from tests.factories import MembershipFactory
    from tests.ovitrap_support import envelope, ingest, setup_field

    ingest(field, envelope(field))
    ingest(field, envelope(field, "ovitrap.check"))
    endpoints = [
        ("ovitraps", Ovitrap.objects.get()),
        ("readings", OvitrapReading.objects.get()),
        ("bags", Bag.objects.get()),
    ]
    denied = MembershipFactory(organization=field.batch.organization, scope=all_scope())
    api_client.force_authenticate(denied.user)
    for path, _row in endpoints:
        assert api_client.get(f"/api/v1/{path}/").status_code == 403
    api_client.force_authenticate(field.batch.user)
    for path, row in endpoints:
        result = api_client.get(
            f"/api/v1/{path}/", {"code": row.code if hasattr(row, "code") else str(row.pk)}
        )
        assert result.status_code == 200, result.data
        assert result.data["count"] == 1
        assert result.data["results"][0]["event_id"] == str(row.event_id)
        public_id = row.client_uuid if isinstance(row, Ovitrap) else row.pk
        assert result.data["results"][0]["id"] == str(public_id)
        detail = api_client.get(f"/api/v1/{path}/{public_id}/")
        assert detail.status_code == 200, detail.data
        assert detail.data["event_id"] == str(row.event_id)
        if isinstance(row, OvitrapReading):
            assert detail.data["ovitrap"] == str(field.identity)
    foreign = setup_field()
    foreign.identity = field.identity
    foreign_placement = envelope(foreign)
    assert ingest(foreign, foreign_placement).status == "accepted"
    own_ovitrap = Ovitrap.objects.get(organization=field.batch.organization)
    foreign_ovitrap = Ovitrap.objects.get(organization=foreign.batch.organization)
    assert own_ovitrap.pk != foreign_ovitrap.pk
    assert own_ovitrap.client_uuid == foreign_ovitrap.client_uuid == field.identity
    api_client.force_authenticate(foreign.batch.user)
    for path, row in endpoints:
        public_id = row.client_uuid if isinstance(row, Ovitrap) else row.pk
        detail = api_client.get(f"/api/v1/{path}/{public_id}/")
        if isinstance(row, Ovitrap):
            assert detail.status_code == 200, detail.data
            assert detail.data["event_id"] == str(foreign_placement.id)
        else:
            assert detail.status_code == 404
        assert api_client.get(f"/api/v1/{path}/", {"point": str(field.point.pk)}).status_code == 404
    api_client.force_authenticate(field.batch.user)
    other_center = Center.objects.create(
        organization=field.batch.organization, code="C-hidden", name="Hidden center"
    )
    other_quadrant = Quadrant.objects.create(
        organization=field.batch.organization,
        center=field.point.block.quadrant.center,
        code="Q-hidden",
    )
    for scope in [
        {**all_scope(), "centers": {"mode": "selected", "ids": [str(other_center.pk)]}},
        {**all_scope(), "quadrants": {"mode": "selected", "ids": [str(other_quadrant.pk)]}},
        {**all_scope(), "quadrants": {"mode": "selected", "ids": []}},
    ]:
        field.membership.scope = scope
        field.membership.save(update_fields=["scope"])
        for path, row in endpoints:
            assert api_client.get(f"/api/v1/{path}/").data["count"] == 0
            public_id = row.client_uuid if isinstance(row, Ovitrap) else row.pk
            assert api_client.get(f"/api/v1/{path}/{public_id}/").status_code == 404
            assert (
                api_client.get(f"/api/v1/{path}/", {"point": str(field.point.pk)}).status_code
                == 404
            )


@pytest.mark.django_db
def test_delivered_catalog_version_keeps_its_labels_and_missing_archive_reviews(field, api_client):
    from dataclasses import replace

    from catalogs.models import CatalogItem, CatalogSnapshot
    from ovitraps.models import OvitrapReading
    from tests.ovitrap_support import envelope, ingest

    api_client.force_authenticate(field.batch.user)
    snapshot = api_client.get("/api/v1/field/catalog/")
    assert snapshot.status_code == 200
    version = snapshot.data["version"]
    assert api_client.get("/api/v1/field/catalog/", HTTP_IF_NONE_MATCH=version).status_code == 304
    assert (
        CatalogSnapshot.objects.filter(
            organization=field.batch.organization, version=version
        ).count()
        == 1
    )
    item = CatalogItem.objects.get(
        organization=field.batch.organization, catalog__slug="ovitrap-finding", code="intact"
    )
    original_label = item.label_es
    CatalogItem.objects.filter(pk=item.pk).update(label_es="Updated after phone download")
    ingest(field, envelope(field))
    sent = replace(envelope(field, "ovitrap.check"), catalog_version=version)
    assert ingest(field, sent).status == "accepted"
    assert OvitrapReading.objects.get().finding_label["es-MX"] == original_label
    missing = replace(
        envelope(field, "ovitrap.check"), catalog_version="unknown-or-predates-archive"
    )
    result = ingest(field, missing)
    assert (result.status, result.code) == ("in_review", "ovitrap_catalog_version_unavailable")
    assert OvitrapReading.objects.count() == 1


@pytest.mark.django_db
def test_speed_anomaly_reviews_without_a_new_placement(field):
    from dataclasses import replace
    from datetime import timedelta

    from field_sync.envelope import GpsFix
    from geography.models import PointVersion
    from ovitraps.models import Ovitrap
    from tests.ovitrap_support import CAPTURED, envelope, ingest, make_point

    ingest(field, envelope(field))
    second = make_point(field.point.block.quadrant, "P-speed")
    PointVersion.objects.create(
        organization=field.batch.organization,
        point=second,
        version=2,
        location=[-99.98, 20.005],
        effective_from=CAPTURED - timedelta(days=1),
    )
    sent = replace(
        envelope(field, payload={"sampling_point_id": str(second.pk), "ovitrap_id": str(uuid4())}),
        device_time=CAPTURED + timedelta(seconds=1),
        gps=GpsFix(20.005, -99.98, 5),
    )
    result = ingest(field, sent)
    assert (result.status, result.code) == ("in_review", "ovitrap_speed_anomaly")
    assert Ovitrap.objects.count() == 1


@pytest.mark.django_db
def test_void_after_scope_loss_cannot_disclose_dependents_or_correct_records(field):
    from field_sync.models import FieldEvent
    from organizations.models import all_scope
    from ovitraps.models import OvitrapVoid
    from tests.ovitrap_support import envelope, ingest

    placed = envelope(field)
    checked = envelope(field, "ovitrap.check")
    ingest(field, placed)
    ingest(field, checked)
    field.membership.scope = {**all_scope(), "centers": {"mode": "none", "ids": []}}
    field.membership.save(update_fields=["scope"])
    for original in (placed, checked):
        result = ingest(
            field,
            envelope(
                field,
                "record.void",
                voids_event_id=original.id,
                payload={"reason_code": "other", "reason": "Correction after reassignment"},
            ),
        )
        assert result.code == (
            "ovitrap_point_inaccessible"
            if original.type == "ovitrap.place"
            else "ovitrap_inaccessible"
        )
        assert result.params == {"voids_event_id": str(original.id)}
        assert FieldEvent.objects.get(pk=original.id).voided_at is None
    assert not OvitrapVoid.objects.exists()


@pytest.mark.parametrize(
    ("mode", "instant", "expected"),
    [
        ("iso", "2026-01-04T18:00:00+00:00", "2026-W01"),
        ("mmwr", "2026-01-04T18:00:00+00:00", "2026-W01"),
        ("mmwr", "2026-01-03T18:00:00+00:00", "2025-W53"),
        ("iso", "2026-01-05T01:00:00+00:00", "2026-W01"),
    ],
)
def test_repeat_window_uses_organization_local_epi_week(mode, instant, expected):
    from datetime import datetime
    from types import SimpleNamespace

    from ovitraps.capture import epi_week

    context = SimpleNamespace(
        organization=SimpleNamespace(timezone="America/Mexico_City", epi_week=mode),
        envelope=SimpleNamespace(device_time=datetime.fromisoformat(instant)),
    )
    assert epi_week(context) == expected


def test_missing_accuracy_reaches_handler_instead_of_losing_event_at_envelope_validation():
    from field_sync.serializers import SyncEventSerializer
    from tests.sync_support import event

    sent = event(type="ovitrap.place", gps={"lat": 20, "lng": -100})
    payload = SyncEventSerializer(data=sent)
    assert payload.is_valid(), payload.errors
    assert payload.validated_data["gps"]["accuracy_m"] is None


def test_foreign_physical_uuid_and_unknown_uuid_share_gps_review(monkeypatch):
    """A foreign identity cannot bypass the same missing-GPS gate as an unused one."""
    from types import SimpleNamespace

    from field_sync.exceptions import EventNeedsReview, EventSignal
    from ovitraps import services
    from ovitraps.models import Ovitrap

    own_org, foreign_org = object(), object()
    foreign_uuid = uuid4()
    foreign_row = {"pk": foreign_uuid, "client_uuid": foreign_uuid, "organization": foreign_org}

    def stored_rows(**filters):
        # In-memory store implements equality only; scope is decided by the real service.
        is_match = all(foreign_row.get(name) == value for name, value in filters.items())
        return SimpleNamespace(exists=lambda: is_match)

    def unusable_gps(_ctx, _point):
        raise EventNeedsReview("ovitrap_gps_unusable")

    monkeypatch.setattr(services, "lock_organization", lambda ctx: None)
    monkeypatch.setattr(services, "accessible_point", lambda ctx, identifier: object())
    monkeypatch.setattr(services, "capture_context", unusable_gps)
    monkeypatch.setattr(Ovitrap.objects, "filter", stored_rows)
    outcomes = []
    for identity in (foreign_uuid, uuid4()):
        with pytest.raises(EventSignal) as outcome:
            services.place_ovitrap(
                SimpleNamespace(organization=own_org),
                {
                    "sampling_point_id": uuid4(),
                    "ovitrap_id": identity,
                    "supply_refs": [],
                    "evidence_ids": [],
                },
            )
        outcomes.append((type(outcome.value), outcome.value.code, outcome.value.params))
    assert outcomes == [(EventNeedsReview, "ovitrap_gps_unusable", {})] * 2
