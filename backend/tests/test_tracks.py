"""Courier track (#370): `track.segment` ingest, insert-only storage and the two reads."""

import json
import math
import uuid
from datetime import datetime, timedelta
from typing import Any

import pytest
from django.db import DatabaseError, connection, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from core.exceptions import ImmutableRecordError, PhysicalDeleteForbiddenError
from organizations.models import Center, Organization
from shifts.models import Shift
from tests.conftest import MemberFactory
from tests.factories import FieldEventFactory, MotorcycleFactory, ShiftFactory
from tests.fleet_support import grant_fleet_scope
from tests.sync_support import SYNC, Phone, batch, configure_clock_skew, event, make_phone
from tracks.models import TrackSegment, TrackViewKind, TrackViewReceipt
from tracks.payloads import TrackSegmentPayloadSerializer
from tracks.permissions import COURIER_TRACK_READ
from tracks.services import record_track_view
from uploads.access import UploadActor

pytestmark = pytest.mark.django_db

POSITIONS = "/api/v1/shifts/positions/"


def track_url(shift_id: object) -> str:
    return f"/api/v1/shifts/{shift_id}/track/"


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


def own_shift(phone: Phone, **overrides: Any) -> Shift:  # noqa: ANN401
    opened = overrides.pop("opened_at_device", timezone.now() - timedelta(hours=1))
    return ShiftFactory(
        organization=phone.organization, courier=phone.user, opened_at_device=opened, **overrides
    )


def segment_event(
    shift_id: object,
    started_at: datetime,
    positions: list[list[Any]],
    **overrides: Any,  # noqa: ANN401
) -> dict[str, Any]:
    last = started_at + timedelta(seconds=positions[-1][0]) if positions else started_at
    return event(
        type="track.segment",
        shift_id=str(shift_id),
        device_time=last.isoformat(),
        payload={"started_at": started_at.isoformat(), "positions": positions},
        **overrides,
    )


def only_result(response: Any) -> dict[str, Any]:  # noqa: ANN401
    assert response.status_code == 200, response.data
    (result,) = response.data["results"]
    return dict(result)


def reader(
    organization: Organization,
    make_member: MemberFactory,
    codes: tuple[str, ...] = (COURIER_TRACK_READ,),
) -> tuple[APIClient, Any]:
    user, _ = grant_fleet_scope(make_member(organization, codes))
    client = APIClient()
    client.force_authenticate(user)
    return client, user


def stored_segment(shift: Shift, ended_at: datetime, positions: list[list[Any]]) -> TrackSegment:
    source = FieldEventFactory(
        organization=shift.organization,
        created_by=shift.courier,
        device=shift.device,
        type="track.segment",
        shift_id=shift.pk,
    )
    span = positions[-1][0]
    return TrackSegment.objects.create(
        organization=shift.organization,
        field_event=source,
        shift=shift,
        courier=shift.courier,
        started_at_device=ended_at - timedelta(seconds=span),
        ended_at_device=ended_at,
        position_count=len(positions),
        positions=positions,
    )


# --- ingest ---------------------------------------------------------------------------------


def test_track_segment_is_idempotent(phone: Phone) -> None:
    shift = own_shift(phone)
    start = timezone.now() - timedelta(minutes=5)
    sent = segment_event(shift.pk, start, [[0, 19.4326, -99.1332, 8], [60, 19.4331, -99.1340, 12]])

    first = only_result(phone.sync([sent]))
    second = only_result(phone.sync([sent]))

    assert (first["status"], first["code"]) == ("accepted", "accepted")
    assert second == first
    segment = TrackSegment.objects.get()
    assert (segment.shift, segment.courier, segment.field_event_id) == (
        shift,
        phone.user,
        uuid.UUID(sent["id"]),
    )
    assert (segment.position_count, segment.trimmed_count) == (2, 0)
    assert segment.positions == [[0, 19.4326, -99.1332, 8], [60, 19.4331, -99.134, 12]]
    assert segment.started_at_device == start
    assert segment.ended_at_device == start + timedelta(seconds=60)


def test_track_segment_trims_outside_shift_window(phone: Phone) -> None:
    opened = timezone.now() - timedelta(hours=2)
    shift = own_shift(phone, opened_at_device=opened, is_closed=True)  # closed "now"
    start = opened - timedelta(seconds=60)
    late = int((shift.closed_at_device - start).total_seconds()) + 30
    sent = segment_event(
        shift.pk,
        start,
        [[0, 19.1, -99.1, 5], [60, 19.2, -99.2, 5], [120, 19.3, -99.3, 5], [late, 19.4, -99.4, 5]],
    )

    result = only_result(phone.sync([sent]))

    assert result["status"] == "accepted"
    segment = TrackSegment.objects.get()
    assert (segment.position_count, segment.trimmed_count) == (2, 2)
    assert segment.started_at_device == opened
    assert segment.ended_at_device == opened + timedelta(seconds=60)
    assert segment.positions == [[0, 19.2, -99.2, 5], [60, 19.3, -99.3, 5]]


def test_a_segment_entirely_outside_the_window_is_accepted_without_a_row(phone: Phone) -> None:
    shift = own_shift(phone)
    before = shift.opened_at_device - timedelta(minutes=10)

    result = only_result(phone.sync([segment_event(shift.pk, before, [[0, 19.1, -99.1, 5]])]))

    assert result["status"] == "accepted"
    assert not TrackSegment.objects.exists()


def test_a_shift_of_another_courier_or_organization_is_shift_not_open(
    phone: Phone, org_b: Organization
) -> None:
    others = [
        ShiftFactory(
            organization=phone.organization, opened_at_device=timezone.now() - timedelta(hours=1)
        ),
        ShiftFactory(organization=org_b, opened_at_device=timezone.now() - timedelta(hours=1)),
    ]
    start = timezone.now() - timedelta(minutes=1)
    for shift in [*others, uuid.uuid4()]:
        shift_id = getattr(shift, "pk", shift)
        result = only_result(phone.sync([segment_event(shift_id, start, [[0, 19.1, -99.1, 5]])]))
        assert (result["status"], result["code"]) == ("rejected", "shift_not_open")
        assert result["params"] == {"shift_id": str(shift_id)}
    assert not TrackSegment.objects.exists()


def test_a_segment_without_shift_id_is_invalid_payload(phone: Phone) -> None:
    sent = segment_event(uuid.uuid4(), timezone.now(), [[0, 19.1, -99.1, 5]])
    del sent["shift_id"]

    result = only_result(phone.sync([sent]))

    assert (result["code"], result["params"]) == (
        "invalid_payload",
        {"fields": {"shift_id": ["required"]}},
    )


def test_a_motorcycle_safety_hold_does_not_hide_the_track(phone: Phone) -> None:
    held = MotorcycleFactory(
        organization=phone.organization, is_blocked=True, blocked_reason="out_of_service"
    )
    shift = own_shift(phone, motorcycle=held)

    result = only_result(
        phone.sync([segment_event(shift.pk, timezone.now(), [[0, 19.1, -99.1, 5]])])
    )

    assert result["status"] == "accepted"
    assert TrackSegment.objects.filter(shift=shift).exists()


def test_a_clock_skew_batch_is_in_review_without_a_segment_and_is_counted(
    phone: Phone, make_member: MemberFactory
) -> None:
    configure_clock_skew(phone.organization)
    shift = own_shift(phone)
    sent = segment_event(shift.pk, timezone.now() - timedelta(minutes=1), [[0, 19.1, -99.1, 5]])

    result = only_result(
        phone.sync([sent], sent_at=(timezone.now() + timedelta(hours=3)).isoformat())
    )

    assert (result["status"], result["code"]) == ("in_review", "clock_skew")
    assert not TrackSegment.objects.exists()
    client, _ = reader(phone.organization, make_member)
    body = client.get(track_url(shift.pk)).data
    assert (body["segments"], body["pending_review_count"]) == ([], 1)


TOO_MANY = [[i, 19.1, -99.1, 5] for i in range(251)]


@pytest.mark.parametrize(
    ("positions", "code"),
    [
        (TOO_MANY, "max_length"),
        ([], "min_length"),
        ([[60, 19.1, -99.1, 5], [0, 19.1, -99.1, 5]], "not_ordered"),
        ([[0, 90.5, -99.1, 5]], "invalid_position"),
        ([[0, 19.1, -180.5, 5]], "invalid_position"),
        ([[0, 19.1234567, -99.1, 5]], "invalid_position"),
        ([[0, 19.1, -99.1, 5.5]], "invalid_position"),
        ([[0, 19.1, -99.1, 5001]], "invalid_position"),
        ([[-1, 19.1, -99.1, 5]], "invalid_position"),
        ([[86_401, 19.1, -99.1, 5]], "invalid_position"),
        ([[0, True, -99.1, 5]], "invalid_position"),
        ([[0, 19.1, -99.1]], "invalid_position"),
        ([[0, "19.1", -99.1, 5]], "invalid_position"),
    ],
)
def test_an_invalid_payload_is_rejected(phone: Phone, positions: list[Any], code: str) -> None:
    shift = own_shift(phone)
    sent = segment_event(shift.pk, timezone.now(), [[0, 1, 1, 1]])
    sent["payload"]["positions"] = positions

    result = only_result(phone.sync([sent]))

    assert (result["status"], result["code"]) == ("rejected", "invalid_payload")
    assert result["params"]["fields"]["positions"] == [code]
    assert not TrackSegment.objects.exists()


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_a_non_finite_coordinate_is_invalid(value: float) -> None:
    data = {"started_at": timezone.now().isoformat(), "positions": [[0, value, -99.1, 5]]}

    serializer = TrackSegmentPayloadSerializer(data=data)

    assert not serializer.is_valid()
    assert "positions" in serializer.errors


def test_a_non_finite_number_on_the_wire_is_invalid_payload(phone: Phone) -> None:
    shift = own_shift(phone)
    sent = segment_event(shift.pk, timezone.now(), [[0, "NUMBER", -99.1, 5]])
    text = json.dumps(batch(phone, [sent])).replace('"NUMBER"', "1e400")

    response = phone.client.post(SYNC, text, content_type="application/json")

    result = only_result(response)
    assert (result["status"], result["code"]) == ("rejected", "invalid_payload")


def test_track_segments_are_not_work_sources_of_the_shift(phone: Phone) -> None:
    from shifts.validation import shift_sources

    shift = own_shift(phone)
    segment = stored_segment(shift, timezone.now(), [[0, 19.1, -99.1, 5]])

    assert segment.field_event_id not in set(shift_sources(shift).values_list("pk", flat=True))


# --- insert-only ----------------------------------------------------------------------------


def test_segments_and_receipts_refuse_update_and_delete(
    phone: Phone, make_member: MemberFactory
) -> None:
    shift = own_shift(phone)
    segment = stored_segment(shift, timezone.now(), [[0, 19.1, -99.1, 5]])
    record_track_view(UploadActor(phone.user, phone.organization), TrackViewKind.TRACK, shift)
    receipt = TrackViewReceipt.objects.get()
    for record, field in ((segment, "trimmed_count"), (receipt, "kind")):
        with pytest.raises(ImmutableRecordError):
            record.save(update_fields=[field])
        with pytest.raises(ImmutableRecordError):
            type(record).objects.filter(pk=record.pk).update(created_at=timezone.now())
        with pytest.raises(PhysicalDeleteForbiddenError):
            record.delete()
        table = type(record)._meta.db_table
        for sql in (
            f"UPDATE {table} SET created_at = now() WHERE id = %s",  # noqa: S608 - fixed table
            f"DELETE FROM {table} WHERE id = %s",  # noqa: S608 - fixed table
        ):
            with (
                pytest.raises(DatabaseError, match="insert-only"),
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                cursor.execute(sql, [record.pk])
    assert (TrackSegment.objects.count(), TrackViewReceipt.objects.count()) == (1, 1)


# --- GET /shifts/positions/ -----------------------------------------------------------------


def test_positions_list_the_last_position_of_readable_open_shifts_only(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    now = timezone.now()
    moving = ShiftFactory(organization=org_a)
    stored_segment(moving, now - timedelta(minutes=10), [[0, 19.1, -99.1, 5]])
    stored_segment(moving, now - timedelta(minutes=5), [[0, 19.2, -99.2, 7], [30, 19.3, -99.3, 9]])
    ShiftFactory(organization=org_a)  # open, no position yet: absent
    closed = ShiftFactory(organization=org_a, is_closed=True)
    stored_segment(closed, now - timedelta(minutes=5), [[0, 19.5, -99.5, 5]])
    foreign = ShiftFactory(organization=org_b)
    stored_segment(foreign, now - timedelta(minutes=5), [[0, 19.6, -99.6, 5]])
    client, _ = reader(org_a, make_member)

    response = client.get(POSITIONS)

    assert response.status_code == 200, response.data
    assert response.data == [
        {
            "shift_id": str(moving.pk),
            "shift_code": moving.code,
            "courier": str(moving.courier_id),
            "motorcycle_code": moving.motorcycle.code,
            "lat": 19.3,
            "lng": -99.3,
            "accuracy_m": 9,
            "recorded_at": response.data[0]["recorded_at"],
            "received_at": response.data[0]["received_at"],
        }
    ]
    recorded = datetime.fromisoformat(response.data[0]["recorded_at"])
    assert recorded == now - timedelta(minutes=5)


def test_positions_skip_voided_sources(org_a: Organization, make_member: MemberFactory) -> None:
    shift = ShiftFactory(organization=org_a)
    segment = stored_segment(shift, timezone.now(), [[0, 19.1, -99.1, 5]])
    source = segment.field_event  # void fields are the only mutable ones on FieldEvent
    source.voided_at = timezone.now()
    source.voided_by = shift.courier
    source.void_reason_code = "duplicate"
    source.save(update_fields=["voided_at", "voided_by", "void_reason_code"])
    client, _ = reader(org_a, make_member)

    assert client.get(POSITIONS).data == []
    assert client.get(track_url(shift.pk)).data["segments"] == []


def test_positions_hide_shifts_outside_the_center_scope(
    org_a: Organization, make_member: MemberFactory
) -> None:
    mine = Center.objects.create(organization=org_a, code="MINE", name="Mine")
    other = Center.objects.create(organization=org_a, code="OTHER", name="Other")
    visible = ShiftFactory(
        organization=org_a, motorcycle=MotorcycleFactory(organization=org_a, center=mine)
    )
    hidden = ShiftFactory(
        organization=org_a, motorcycle=MotorcycleFactory(organization=org_a, center=other)
    )
    for shift in (visible, hidden):
        stored_segment(shift, timezone.now(), [[0, 19.1, -99.1, 5]])
    user, membership = make_member(org_a, (COURIER_TRACK_READ,))
    scope = {
        "centers": {"mode": "selected", "ids": [str(mine.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    membership.scope = scope
    membership.save(update_fields=["scope"])
    for profile in membership.profiles.all():
        profile.scope = scope
        profile.save(update_fields=["scope"])
    client = APIClient()
    client.force_authenticate(user)

    assert [row["shift_id"] for row in client.get(POSITIONS).data] == [str(visible.pk)]
    assert client.get(track_url(hidden.pk)).status_code == 404
    assert client.get(track_url(visible.pk)).status_code == 200


@pytest.mark.parametrize("path", [POSITIONS, track_url("00000000-0000-4000-8000-000000000000")])
def test_without_courier_track_read_the_answer_is_403(
    org_a: Organization, make_member: MemberFactory, path: str
) -> None:
    client, _ = reader(org_a, make_member, codes=("shift.read",))

    response = client.get(path)

    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"


def test_positions_write_one_live_receipt_per_hour(
    org_a: Organization, make_member: MemberFactory
) -> None:
    client, user = reader(org_a, make_member)

    for _ in range(3):
        assert client.get(POSITIONS).status_code == 200

    receipt = TrackViewReceipt.objects.get()
    assert (receipt.viewer, receipt.kind, receipt.shift, receipt.organization) == (
        user,
        TrackViewKind.LIVE,
        None,
        org_a,
    )
    assert (receipt.hour.minute, receipt.hour.second) == (0, 0)


# --- GET /shifts/{id}/track/ ----------------------------------------------------------------


def test_track_returns_ordered_segments_and_one_receipt_per_hour(
    org_a: Organization, make_member: MemberFactory
) -> None:
    shift = ShiftFactory(organization=org_a, is_closed=True)
    now = timezone.now()
    later = stored_segment(shift, now, [[0, 19.2, -99.2, 5]])
    earlier = stored_segment(
        shift, now - timedelta(minutes=5), [[0, 19.1, -99.1, 5], [60, 19.15, -99.15, 6]]
    )
    client, user = reader(org_a, make_member)

    responses = [client.get(track_url(shift.pk)) for _ in range(3)]

    body = responses[0].data
    assert all(response.status_code == 200 for response in responses)
    assert (body["shift_id"], body["status"], body["pending_review_count"]) == (
        str(shift.pk),
        "closed",
        0,
    )
    assert [segment["id"] for segment in body["segments"]] == [str(earlier.pk), str(later.pk)]
    assert body["segments"][0]["positions"] == [[0, 19.1, -99.1, 5], [60, 19.15, -99.15, 6]]
    assert set(body["segments"][0]) == {"id", "started_at", "ended_at", "received_at", "positions"}
    receipt = TrackViewReceipt.objects.get()
    assert (receipt.viewer, receipt.kind, receipt.shift) == (user, TrackViewKind.TRACK, shift)


@pytest.mark.parametrize("which", ["foreign", "unknown", "not-a-uuid"])
def test_track_of_a_foreign_or_unknown_shift_is_404(
    org_a: Organization, org_b: Organization, make_member: MemberFactory, which: str
) -> None:
    identifier = {
        "foreign": ShiftFactory(organization=org_b).pk,
        "unknown": uuid.uuid4(),
        "not-a-uuid": "JOR-0001",
    }[which]
    client, _ = reader(org_a, make_member)

    response = client.get(track_url(identifier))

    assert response.status_code == 404
    assert not TrackViewReceipt.objects.exists()
