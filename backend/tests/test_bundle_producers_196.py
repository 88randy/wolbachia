"""#196 projection isolation, lifecycle delivery and atomic fan-out regressions."""

from dataclasses import replace
from datetime import timedelta
from uuid import uuid4

import pytest
from django.db import transaction
from django.utils import timezone
from drf_spectacular.generators import SchemaGenerator
from rest_framework.exceptions import PermissionDenied

from field_sync import producers, selectors, services
from field_sync.cursor import decode_cursor
from field_sync.models import CourierChange
from field_sync.permissions import FIELD_BOOTSTRAP
from field_sync.producers import build_sections, bundle_schema_version
from field_sync.selectors import producer_context
from field_sync.services import bootstrap_bundle, sync_batch
from organizations.models import all_scope
from tests.ovitrap_support import CAPTURED, envelope, ingest, second_courier, setup_field
from tests.test_field_sync_b_13 import BOOTSTRAP, batch_context


@pytest.fixture
def field(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: CAPTURED)
    field = setup_field()
    field.profile.permission_codes += [FIELD_BOOTSTRAP, "quadrant.publish", "sampling_point.create"]
    field.profile.save(update_fields=["permission_codes"])
    return field


def pull(batch, cursor):
    position = decode_cursor(cursor, batch.organization.pk, batch.user.pk)
    return sync_batch(batch, [], position).changes


def test_new_producers_have_concrete_contracts_and_change_schema_boundary(monkeypatch):
    keys = ("quadrants", "sampling_points", "ovitraps")
    assert producers.SECTION_KEYS[-3:] == keys
    assert all(producers.PRODUCERS[key].schema_version == 1 for key in keys)
    current = bundle_schema_version()
    monkeypatch.setattr(
        producers,
        "PRODUCERS",
        {key: value for key, value in producers.PRODUCERS.items() if key not in keys},
    )
    assert bundle_schema_version() != current
    schema = SchemaGenerator(urlconf="config.urls").get_schema(public=True)
    components = schema["components"]["schemas"]
    for key in keys:
        assert "$ref" in components["Bootstrap"]["properties"][key]["items"]
        change = components["Changes"]["properties"][key]["items"]["$ref"].split("/")[-1]
        assert "$ref" in components[change]["properties"]["data"]


@pytest.mark.django_db
def test_lifecycle_fans_out_once_replays_do_not_duplicate_and_bundle_has_no_counts(field):
    other = second_courier(field)
    cursors = [bootstrap_bundle(batch)["cursor"] for batch in (field.batch, other)]
    place = envelope(field)
    assert ingest(field, place).status == "accepted"
    check = envelope(field, "ovitrap.check", device_time=CAPTURED + timedelta(minutes=1))
    assert ingest(field, check).status == "accepted"
    assert ingest(field, check).status == "accepted"
    void = envelope(
        field,
        "record.void",
        payload={"reason_code": "other", "reason": "Wrong visit recorded"},
        voids_event_id=check.id,
        device_time=CAPTURED + timedelta(minutes=2),
    )
    assert ingest(field, void).status == "accepted"
    for batch, cursor in zip((field.batch, other), cursors, strict=True):
        changes = pull(batch, cursor)
        rows = changes.ovitraps
        assert len(rows) == 3
        assert all(row["action"] == "upsert" for row in rows)
        assert rows[1]["data"]["has_eggs"] is True
        assert rows[1]["data"]["finding_code"] == "intact"
        assert rows[-1]["data"]["voided"] is True
        assert rows[-1]["data"]["voided_resource_type"] == "reading"
        assert rows[-1]["data"]["void_reason_code"] == "other"
        assert rows[-1]["data"]["has_eggs"] is None
        assert pull(batch, changes.cursor).ovitraps == []
        bundle = bootstrap_bundle(batch)
        assert bundle["sampling_points"][0]["id"] == str(field.point.pk)
        assert bundle["ovitraps"] == [rows[-1]["data"]]
        assert (
            not {"egg_count", "count", "temperature_c", "humidity_pct", "created_by"}
            & rows[1]["data"].keys()
        )
    assert CourierChange.objects.filter(kind="ovitraps").count() == 6


@pytest.mark.django_db
def test_voided_placement_remains_a_tombstone_in_snapshot_and_feed(field):
    before = bootstrap_bundle(field.batch)["cursor"]
    place = envelope(field)
    ingest(field, place)
    void = envelope(
        field,
        "record.void",
        payload={"reason_code": "other", "reason": "Wrong placement recorded"},
        voids_event_id=place.id,
    )
    assert ingest(field, void).status == "accepted"
    rows = pull(field.batch, before).ovitraps
    assert len(rows) == 2
    tombstone = rows[-1]["data"]
    assert tombstone["voided"] is True
    assert tombstone["voided_resource_type"] == "placement"
    assert tombstone["voided_at"] is not None
    assert bootstrap_bundle(field.batch)["ovitraps"] == [tombstone]


@pytest.mark.django_db
def test_bundle_build_query_count_stays_bounded_as_points_and_readings_grow(
    field, django_assert_max_num_queries
):
    from tests.ovitrap_support import make_point

    ingest(field, envelope(field))
    ingest(field, envelope(field, "ovitrap.check"))
    from types import SimpleNamespace

    for number in range(4):
        point = make_point(field.point.block.quadrant, f"P-extra-{number}")
        extra = SimpleNamespace(**{**vars(field), "point": point, "identity": uuid4()})
        assert ingest(extra, envelope(extra)).status == "accepted"
        assert (
            ingest(
                extra, envelope(extra, "ovitrap.check", payload={"bag_code": f"B-extra-{number}"})
            ).status
            == "accepted"
        )
    with transaction.atomic():
        services.lock_courier_batches(field.batch)
        ctx = producer_context(field.batch, FIELD_BOOTSTRAP)
        with django_assert_max_num_queries(4):
            sections = build_sections(ctx)
    assert len(sections["sampling_points"]) == 5
    assert len(sections["ovitraps"]) == 5


@pytest.mark.django_db
def test_fanout_cap_fails_closed_before_domain_write(field, settings):
    from field_sync.exceptions import FanoutLimitExceededError
    from ovitraps.models import Ovitrap

    second_courier(field)
    settings.SYNC_MAX_FANOUT_COURIERS = 1
    with pytest.raises(FanoutLimitExceededError):
        ingest(field, envelope(field))
    assert not Ovitrap.objects.exists()
    assert not CourierChange.objects.exists()


@pytest.mark.django_db
def test_bundle_and_feed_isolate_both_scope_dimensions_organization_and_sync_only(field):
    from field_sync.cursor import ChangesCursor
    from geography.models import Quadrant
    from organizations.models import Center, Membership
    from tests.factories import MembershipFactory, ProfileFactory
    from tests.ovitrap_support import make_point

    organization = field.batch.organization
    quadrant = field.point.block.quadrant
    other_center = Center.objects.create(organization=organization, code="other", name="Other")
    other_quadrant = Quadrant.objects.create(
        organization=organization, center=quadrant.center, code="other"
    )
    cross_center_quadrant = Quadrant.objects.create(
        organization=organization, center=other_center, code="cross"
    )
    other_point = make_point(other_quadrant, "other")
    cross_center_point = make_point(cross_center_quadrant, "cross")
    outsider = setup_field()
    for foreign in (other_point, cross_center_point):
        # Authored namespaces share capture rules but keep separate physical identities.
        from types import SimpleNamespace

        own_field = SimpleNamespace(**{**vars(field), "point": foreign, "identity": uuid4()})
        assert ingest(own_field, envelope(own_field)).status == "accepted"
    assert ingest(outsider, envelope(outsider)).status == "accepted"
    selected = {
        "centers": {"mode": "selected", "ids": [str(quadrant.center_id)]},
        "quadrants": {"mode": "selected", "ids": [str(quadrant.pk), str(cross_center_quadrant.pk)]},
    }
    field.membership.scope = selected
    field.membership.save(update_fields=["scope"])
    peer = second_courier(field)
    peer_membership = Membership.objects.get(user=peer.user, organization=organization)
    peer_membership.scope = selected
    peer_membership.save(update_fields=["scope"])
    excluded_peer = second_courier(field)
    excluded_membership = Membership.objects.get(user=excluded_peer.user, organization=organization)
    excluded_membership.scope = {
        "centers": {"mode": "selected", "ids": [str(other_center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    excluded_membership.save(update_fields=["scope"])
    sync_only = second_courier(field)
    membership = Membership.objects.get(user=sync_only.user, organization=organization)
    profile = ProfileFactory(
        organization=organization, scope=all_scope(), permission_codes=["field_event.sync"]
    )
    membership.profiles.set([profile])
    inactive = MembershipFactory(organization=organization, is_active=False, scope=all_scope())
    inactive.profiles.add(field.profile)
    before = bootstrap_bundle(field.batch)["cursor"]
    assert ingest(field, envelope(field)).status == "accepted"
    local = bootstrap_bundle(field.batch)
    assert [row["id"] for row in local["sampling_points"]] == [str(field.point.pk)]
    assert [row["id"] for row in local["ovitraps"]] == [str(field.identity)]
    assert [row["resource_id"] for row in pull(field.batch, before).ovitraps] == [
        str(field.identity)
    ]
    allowed_users = {field.batch.user.pk, peer.user.pk}
    own_changes = CourierChange.objects.filter(resource_id=str(field.identity))
    assert set(own_changes.values_list("courier_id", flat=True)) == allowed_users
    assert bootstrap_bundle(peer)["ovitraps"] == local["ovitraps"]
    ctx = producer_context(sync_only, "field_event.sync")

    assert all(
        not rows for rows in build_sections(replace(ctx, permission=FIELD_BOOTSTRAP)).values()
    )
    with pytest.raises(PermissionDenied):
        bootstrap_bundle(sync_only)
    assert not CourierChange.objects.filter(courier=inactive.user).exists()
    assert sync_batch(sync_only, [], ChangesCursor()).changes.ovitraps == []


def phone_for(batch):
    from rest_framework.test import APIClient

    from accounts.services import DeviceInfo, start_device_session
    from tests.sync_support import Phone

    issued = start_device_session(
        batch.user, batch.organization, DeviceInfo(device_id=batch.device.pk)
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    return Phone(client, batch.user, batch.organization, batch.device.pk, issued)


@pytest.mark.django_db
def test_scope_revision_invalidates_cursor_and_bootstrap_replaces_downloaded_rows(field):
    from geography.models import Quadrant
    from organizations.models import Center
    from tests.ovitrap_support import make_point

    center = Center.objects.create(organization=field.batch.organization, code="new", name="New")
    quadrant = Quadrant.objects.create(
        organization=field.batch.organization, center=center, code="new"
    )
    newly_visible = make_point(quadrant, "new")
    field.membership.scope = {
        "centers": {"mode": "selected", "ids": [str(field.point.center_id)]},
        "quadrants": {"mode": "selected", "ids": [str(field.point.quadrant_id)]},
    }
    field.membership.save(update_fields=["scope"])
    phone = phone_for(field.batch)
    before = phone.client.get(BOOTSTRAP).data
    assert [row["id"] for row in before["sampling_points"]] == [str(field.point.pk)]
    field.membership.scope = {
        "centers": {"mode": "selected", "ids": [str(center.pk)]},
        "quadrants": {"mode": "selected", "ids": [str(quadrant.pk)]},
    }
    field.membership.save(update_fields=["scope"])
    invalid = phone.sync([], cursor=before["cursor"])
    assert (invalid.status_code, invalid.data["code"]) == (400, "invalid_cursor")
    after = phone.client.get(BOOTSTRAP).data
    assert [row["id"] for row in after["sampling_points"]] == [str(newly_visible.pk)]
    assert phone.sync([], cursor=after["cursor"]).status_code == 200


@pytest.mark.django_db
def test_restoring_identical_scope_still_invalidates_cursor(field):
    """Rows published while the courier was out of scope have no change for it."""
    phone = phone_for(field.batch)
    cursor = phone.client.get(BOOTSTRAP).data["cursor"]
    original = field.membership.scope
    for scope in (
        {"centers": {"mode": "none", "ids": []}, "quadrants": {"mode": "none", "ids": []}},
        original,
    ):
        field.membership.scope = scope
        field.membership.revision += 1
        field.membership.save(update_fields=["scope", "revision"])
    invalid = phone.sync([], cursor=cursor)
    assert (invalid.status_code, invalid.data["code"]) == (400, "invalid_cursor")


@pytest.mark.django_db
def test_producer_schema_change_invalidates_cursor_issued_before_it(field, monkeypatch):
    phone = phone_for(field.batch)
    cursor = phone.client.get(BOOTSTRAP).data["cursor"]
    monkeypatch.setattr(selectors, "bundle_schema_version", lambda: "new-producers")
    invalid = phone.sync([], cursor=cursor)
    assert (invalid.status_code, invalid.data["code"]) == (400, "invalid_cursor")


@pytest.mark.django_db
@pytest.mark.parametrize("decision", ["keep", "move", "remove"])
def test_quadrant_republish_upserts_resolution_points_and_ovitraps_in_same_scope(field, decision):
    from geography.models import QuadrantVersion
    from geography.services import PointResolution, QuadrantPublication, publish_quadrant

    quadrant = field.point.block.quadrant
    full = {
        "type": "Polygon",
        "coordinates": [[[-100, 20], [-99.98, 20], [-99.98, 20.02], [-100, 20.02], [-100, 20]]],
    }
    shrunk = {
        "type": "Polygon",
        "coordinates": [
            [[-100, 20.01], [-99.98, 20.01], [-99.98, 20.02], [-100, 20.02], [-100, 20.01]]
        ],
    }
    QuadrantVersion.objects.create(
        organization=field.batch.organization,
        quadrant=quadrant,
        revision=1,
        geometry=full,
        effective_from=CAPTURED - timedelta(days=1),
    )
    assert ingest(field, envelope(field)).status == "accepted"
    peer = second_courier(field)
    cursors = [bootstrap_bundle(batch)["cursor"] for batch in (field.batch, peer)]
    location = [-99.99, 20.015] if decision == "move" else None
    publish_quadrant(
        quadrant,
        QuadrantPublication(
            field.membership,
            1,
            shrunk,
            (PointResolution(field.point.pk, decision, "Reviewed boundary resolution", location),),
        ),
    )
    for batch, cursor in zip((field.batch, peer), cursors, strict=True):
        changes = pull(batch, cursor)
        assert [row["resource_version"] for row in changes.quadrants] == ["2"]
        assert len(changes.sampling_points) == len(changes.ovitraps) == 1
        point = changes.sampling_points[0]
        assert point["action"] == "upsert"
        assert point["data"]["is_retired"] is (decision == "remove")
        assert point["data"]["block_id"] == str(field.point.block_id)
        assert point["data"]["version"] == 2
        assert changes.ovitraps[0]["data"]["sampling_point_version"] == 2
        assert changes.ovitraps[0]["action"] == "upsert"
        assert pull(batch, changes.cursor).sampling_points == []


@pytest.mark.django_db
def test_sync_contention_maps_to_retryable_429_with_no_partial_writes(field, monkeypatch):
    from field_sync.exceptions import SyncInProgressError
    from ovitraps.models import Ovitrap
    from tests.sync_support import event

    other = second_courier(field)
    phone = phone_for(field.batch)
    before = bootstrap_bundle(batch_context(phone))["cursor"]
    real_lock = services.lock_courier_batches

    def contend(batch):
        if batch.user.pk == other.user.pk:
            raise SyncInProgressError
        real_lock(batch)

    monkeypatch.setattr(services, "lock_courier_batches", contend)
    pending = envelope(field)
    sent = event(
        id=str(pending.id),
        type=pending.type,
        payload=pending.payload,
        device_time=CAPTURED.isoformat(),
        catalog_version=field.catalog_version,
        gps={"lat": 20.005, "lng": -99.99, "accuracy_m": 5},
    )
    response = phone.sync([sent], cursor=before)
    assert (response.status_code, response.data["code"]) == (429, "sync_in_progress")
    assert response["Retry-After"]
    assert not Ovitrap.objects.exists()
    assert not CourierChange.objects.exists()


@pytest.mark.django_db
def test_rejected_event_rolls_back_changes_already_appended_in_its_savepoint(field, monkeypatch):
    from field_sync.exceptions import EventRejected
    from ovitraps import services as ovitrap_services
    from ovitraps.models import Ovitrap

    real_emit = ovitrap_services.emit_ovitrap

    def reject_after_append(ovitrap, emit):
        real_emit(ovitrap, emit)
        raise EventRejected("ovitrap_point_occupied")

    monkeypatch.setattr(ovitrap_services, "emit_ovitrap", reject_after_append)
    result = ingest(field, envelope(field))
    assert result.status == "rejected"
    assert not Ovitrap.objects.exists()
    assert not CourierChange.objects.exists()


@pytest.mark.django_db
def test_void_latest_reading_restores_previous_nonvoided_check_state(field):
    assert ingest(field, envelope(field)).status == "accepted"
    first = envelope(field, "ovitrap.check")
    assert ingest(field, first).status == "accepted"
    next_week = CAPTURED + timedelta(days=7)
    field.batch = replace(field.batch, sent_at=next_week, received_at=next_week)
    second = envelope(
        field,
        "ovitrap.check",
        device_time=next_week,
        payload={"bag_code": "B-later", "has_eggs": False, "is_lagged": True},
    )
    assert ingest(field, second).status == "accepted"
    before = bootstrap_bundle(field.batch)
    assert before["ovitraps"][0]["has_eggs"] is False
    void = envelope(
        field,
        "record.void",
        device_time=next_week,
        payload={"reason_code": "other", "reason": "Wrong later visit recorded"},
        voids_event_id=second.id,
    )
    assert ingest(field, void).status == "accepted"
    rows = pull(field.batch, before["cursor"]).ovitraps
    assert len(rows) == 1
    restored = rows[0]["data"]
    assert restored["has_eggs"] is True
    assert restored["is_lagged"] is False
    assert restored["checked_at"] == CAPTURED.isoformat().replace("+00:00", "Z")
    assert restored["voided_event_id"] == str(second.id)
    assert bootstrap_bundle(field.batch)["ovitraps"] == [restored]


@pytest.mark.django_db
def test_geography_creation_and_publication_writers_emit_exact_versions(field):
    from geography.services import (
        BlockCreation,
        BlockPublication,
        PointChange,
        PointCreation,
        QuadrantCreation,
        create_block,
        create_quadrant,
        create_sampling_point,
        publish_block,
        publish_point,
    )
    from tests.test_geography_b_11 import polygon

    before = bootstrap_bundle(field.batch)["cursor"]
    quadrant, _ = create_quadrant(
        field.point.block.quadrant.center, QuadrantCreation(field.membership, "Q-new", polygon())
    )
    block, _ = create_block(quadrant, BlockCreation(field.membership, "B-new", polygon()))
    point, _, _ = create_sampling_point(
        block, PointCreation(field.membership, "P-new", [-99.995, 20.005])
    )
    publish_block(block, BlockPublication(field.membership, 1, polygon()))
    publish_point(point, PointChange(field.membership, 1, [-99.9951, 20.005]))
    changes = pull(field.batch, before)
    assert [(row["resource_type"], row["resource_version"]) for row in changes.quadrants] == [
        ("quadrant", "1"),
        ("block", "1"),
        ("block", "2"),
    ]
    assert [(row["resource_id"], row["resource_version"]) for row in changes.sampling_points] == [
        (str(point.pk), "1"),
        (str(point.pk), "2"),
    ]
    bundle = bootstrap_bundle(field.batch)
    assert {row["resource_type"]: row["revision"] for row in bundle["quadrants"]} == {
        "quadrant": 1,
        "block": 2,
    }
    assert (
        next(row for row in bundle["sampling_points"] if row["id"] == str(point.pk))["version"] == 2
    )


@pytest.mark.parametrize(("offset", "expected_eggs"), [(-1, True), (1, False)])
def test_pending_offline_check_cannot_replace_newer_device_time_state(offset, expected_eggs):
    from field_sync.envelope import EventEnvelope, describe_payload
    from ovitraps.models import Ovitrap, OvitrapReading
    from ovitraps.selectors import latest_check_with_pending

    saved_event = uuid4()
    ovitrap = Ovitrap()
    ovitrap.latest_check = {
        "event_id": str(saved_event),
        "checked_at": CAPTURED.isoformat(),
        "has_eggs": True,
    }
    pending = EventEnvelope(
        0,
        uuid4(),
        "ovitrap.check",
        1,
        CAPTURED + timedelta(seconds=offset),
        {},
        describe_payload({}),
        "",
        "",
        False,
    )
    reading = OvitrapReading(
        event_id=pending.id,
        finding_code="intact",
        paddle_present=True,
        has_eggs=False,
        is_lagged=False,
    )
    assert latest_check_with_pending(ovitrap, reading, pending)["has_eggs"] is expected_eggs


@pytest.mark.django_db
@pytest.mark.parametrize("event_type", ["ovitrap.place", "ovitrap.check"])
def test_void_reviewed_event_without_operational_row_preserves_history_without_projection(
    field, event_type
):
    from ovitraps.models import OvitrapVoid

    if event_type == "ovitrap.check":
        assert ingest(field, envelope(field)).status == "accepted"
    before = bootstrap_bundle(field.batch)
    reviewed = envelope(field, event_type, gps=None)
    assert ingest(field, reviewed).status == "in_review"
    void = envelope(
        field,
        "record.void",
        payload={"reason_code": "other", "reason": "Wrong reviewed capture"},
        voids_event_id=reviewed.id,
    )
    assert ingest(field, void).status == "accepted"
    assert OvitrapVoid.objects.filter(target_event_id=reviewed.id).exists()
    assert pull(field.batch, before["cursor"]).ovitraps == []
    assert bootstrap_bundle(field.batch)["ovitraps"] == before["ovitraps"]
