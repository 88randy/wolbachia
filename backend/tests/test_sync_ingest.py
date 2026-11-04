"""`POST /field/sync/`: the event pipeline (validation, partial batches, ordering, review items)."""

import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.test import override_settings
from django.utils import timezone

from field_sync.models import FieldEvent
from organizations.models import Organization
from reviews.models import ReviewItem
from tests.conftest import MemberFactory
from tests.factories import ShiftFactory
from tests.sync_support import Phone, event, make_phone
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


def results_of(response: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    assert response.status_code == 200, response.data
    return response.data["results"]  # type: ignore[no-any-return]


def test_an_accepted_event_is_stored_with_everything_the_phone_sent(phone: Phone) -> None:
    shift = ShiftFactory(organization=phone.organization, courier=phone.user)
    sent = event(
        shift_id=str(shift.id),
        gps={"lat": 19.43, "lng": -99.13, "accuracy_m": 8.5},
        manual_capture=True,
    )

    response = phone.sync([sent])

    assert results_of(response) == [
        {"id": sent["id"], "status": "accepted", "code": "accepted", "params": {}}
    ]
    stored = FieldEvent.objects.get(pk=sent["id"])
    assert (stored.organization, stored.created_by, stored.device_id) == (
        phone.organization,
        phone.user,
        phone.device_id,
    )
    assert (stored.type, stored.schema_version, stored.payload) == (
        "test.note",
        1,
        {"text": "hello"},
    )
    assert (stored.gps_lat, stored.gps_lng, stored.gps_accuracy_m) == (19.43, -99.13, 8.5)
    assert (stored.rules_version, stored.catalog_version) == ("rules-1", "catalog-1")
    assert (stored.manual_capture, str(stored.shift_id)) == (True, sent["shift_id"])
    assert stored.server_received_at >= stored.device_time - timedelta(seconds=5)
    assert (stored.status, stored.status_code, stored.is_final_upload) == (
        "accepted",
        "accepted",
        False,
    )
    assert len(stored.payload_sha256) == 64
    assert Widget.objects.filter(name="hello").count() == 1
    assert not ReviewItem.objects.exists()


def test_the_organization_comes_from_the_session_never_from_the_body(
    phone: Phone, org_b: Organization
) -> None:
    sent = event(organization_id=str(org_b.pk), organization=str(org_b.pk))

    phone.sync([sent])

    assert FieldEvent.objects.get(pk=sent["id"]).organization == phone.organization


def test_unknown_event_type_is_rejected_with_its_raw_payload_kept_and_a_review_item(
    phone: Phone,
) -> None:
    sent = event(type="ovitrap.unknown", payload={"anything": [1, 2, {"x": None}]})

    response = phone.sync([sent])

    assert results_of(response) == [
        {
            "id": sent["id"],
            "status": "rejected",
            "code": "unsupported_event_type",
            "params": {"type": "ovitrap.unknown", "schema_version": 1},
        }
    ]
    stored = FieldEvent.objects.get(pk=sent["id"])
    assert (stored.status, stored.payload) == ("rejected", {"anything": [1, 2, {"x": None}]})
    item = ReviewItem.objects.get(field_event=stored)
    assert (item.kind, item.code, item.event_type) == (
        "rejected",
        "unsupported_event_type",
        "ovitrap.unknown",
    )
    assert (item.courier, item.device_id, item.organization) == (
        phone.user,
        phone.device_id,
        phone.organization,
    )


def test_a_known_type_with_an_unknown_schema_version_says_so(phone: Phone) -> None:
    response = phone.sync([event(schema_version=7)])

    assert results_of(response)[0]["code"] == "unsupported_schema_version"
    assert results_of(response)[0]["params"] == {"type": "test.note", "schema_version": 7}


def test_an_invalid_payload_is_rejected_with_the_failing_fields(phone: Phone) -> None:
    response = phone.sync([event(payload={"text": "x" * 51}), event(payload={})])

    assert [(r["status"], r["code"]) for r in results_of(response)] == [
        ("rejected", "invalid_payload")
    ] * 2
    assert results_of(response)[0]["params"] == {"fields": {"text": ["max_length"]}}
    assert results_of(response)[1]["params"] == {"fields": {"text": ["required"]}}
    assert not Widget.objects.exists()


def test_a_payload_over_the_event_limit_is_rejected_not_the_batch(phone: Phone) -> None:
    big = event(payload={"text": "x" * 50, "padding": "y" * 200})

    with override_settings(SYNC_MAX_EVENT_PAYLOAD_BYTES=100):
        response = phone.sync([big, event()])

    first, second = results_of(response)
    assert (first["status"], first["code"], first["params"]) == (
        "rejected",
        "event_payload_too_large",
        {"max_bytes": 100},
    )
    assert second["status"] == "accepted"
    stored = FieldEvent.objects.get(pk=big["id"]).payload
    assert stored["_not_stored"] == "event_payload_too_large"  # the junk is not kept (decision 74)
    assert stored["size_bytes"] > 100


def test_a_nul_character_in_the_payload_is_rejected_instead_of_breaking_the_database(
    phone: Phone,
) -> None:
    response = phone.sync([event(payload={"text": "a\u0000b"}), event(payload={"text": "ok"})])

    first, second = results_of(response)
    assert (first["code"], first["params"]) == (
        "invalid_payload",
        {"fields": {"payload": ["null_character"]}},
    )
    assert second["status"] == "accepted"


def test_a_rejected_nul_payload_is_stored_with_the_character_replaced(phone: Phone) -> None:
    sent = event(payload={"text": "a\u0000b", "k\u0000ey": ["x\u0000"]})

    phone.sync([sent])

    stored = FieldEvent.objects.get(pk=sent["id"])
    assert (stored.status, stored.status_code) == ("rejected", "invalid_payload")
    assert stored.payload == {"text": "a\ufffdb", "k\ufffdey": ["x\ufffd"]}


def test_a_payload_nested_deeper_than_the_limit_is_rejected_and_not_stored_as_is(
    phone: Phone,
) -> None:
    deep: dict[str, Any] = {}
    leaf = deep
    for _ in range(40):
        leaf["x"] = {}
        leaf = leaf["x"]
    sent = event(payload=deep)

    response = phone.sync([sent, event()])

    first, second = results_of(response)
    assert (first["code"], first["params"]) == (
        "invalid_payload",
        {"fields": {"payload": ["too_deep"]}},
    )
    assert second["status"] == "accepted"
    assert FieldEvent.objects.get(pk=sent["id"]).payload == {
        "_not_stored": "invalid_payload",
        "size_bytes": None,
    }


def test_a_voids_event_id_on_another_event_type_is_rejected(phone: Phone) -> None:
    response = phone.sync([event(voids_event_id=str(uuid.uuid4()))])

    assert results_of(response)[0]["params"]["fields"] == {"voids_event_id": ["not_allowed"]}


def test_a_partial_batch_keeps_the_valid_events_and_leaves_no_trace_of_the_invalid_one(
    phone: Phone,
) -> None:
    good_first, bad, good_last = (
        event(payload={"text": "first"}),
        event(type="test.reject_after_write", payload={"text": "boom"}),
        event(payload={"text": "last"}),
    )

    response = phone.sync([good_first, bad, good_last])

    statuses = [(r["status"], r["code"]) for r in results_of(response)]
    assert statuses == [
        ("accepted", "accepted"),
        ("rejected", "test_rejection"),
        ("accepted", "accepted"),
    ]
    assert results_of(response)[1]["params"] == {"text": "boom"}
    assert sorted(Widget.objects.values_list("name", flat=True)) == ["first", "last"]
    assert FieldEvent.objects.get(pk=bad["id"]).status == "rejected"
    assert ReviewItem.objects.filter(field_event_id=bad["id"], kind="rejected").count() == 1


def test_a_handler_that_asks_for_review_keeps_its_writes_and_lands_in_review(phone: Phone) -> None:
    sent = event(type="test.needs_review", payload={"text": "look at me"})

    response = phone.sync([sent])

    assert results_of(response) == [
        {
            "id": sent["id"],
            "status": "in_review",
            "code": "test_review",
            "params": {"text": "look at me"},
        }
    ]
    assert Widget.objects.filter(name="written-before-review").count() == 1
    item = ReviewItem.objects.get(field_event_id=sent["id"])
    assert (item.kind, item.code, item.params) == (
        "in_review",
        "test_review",
        {"text": "look at me"},
    )


def test_events_are_processed_in_device_time_order_and_answered_in_request_order(
    phone: Phone,
) -> None:
    now = timezone.now()
    late = event(device_time=(now - timedelta(minutes=1)).isoformat(), payload={"text": "late"})
    early = event(device_time=(now - timedelta(minutes=9)).isoformat(), payload={"text": "early"})

    response = phone.sync([late, early])

    assert [r["id"] for r in results_of(response)] == [late["id"], early["id"]]
    written = list(Widget.objects.order_by("created_at").values_list("name", flat=True))
    assert written == ["early", "late"]


def test_ties_in_device_time_are_broken_by_event_id(phone: Phone) -> None:
    moment = timezone.now().isoformat()
    low = event(
        id="00000000-0000-4000-8000-000000000001", device_time=moment, payload={"text": "low"}
    )
    high = event(
        id="ffffffff-0000-4000-8000-000000000001", device_time=moment, payload={"text": "high"}
    )

    phone.sync([high, low])

    assert list(Widget.objects.order_by("created_at").values_list("name", flat=True)) == [
        "low",
        "high",
    ]


def test_an_event_older_than_what_the_server_already_has_is_still_processed(phone: Phone) -> None:
    now = timezone.now()
    phone.sync([event(device_time=now.isoformat())])

    response = phone.sync([event(device_time=(now - timedelta(days=3)).isoformat())])

    assert results_of(response)[0]["status"] == "accepted"


def test_an_empty_batch_is_a_pure_pull(phone: Phone) -> None:
    response = phone.sync([])

    assert response.status_code == 200
    assert response.data["results"] == []
    assert not FieldEvent.objects.exists()


def test_payload_serializers_can_use_org_scoped_relations(
    phone: Phone, org_b: Organization
) -> None:
    mine = Widget.objects.create(organization=phone.organization, name="mine")
    theirs = Widget.objects.create(organization=org_b, name="theirs")

    response = phone.sync(
        [
            event(type="test.related", payload={"widget": str(mine.pk)}),
            event(type="test.related", payload={"widget": str(theirs.pk)}),
        ]
    )

    first, second = results_of(response)
    assert first["status"] == "accepted"
    assert (second["code"], second["params"]) == (
        "invalid_payload",
        {"fields": {"widget": ["does_not_exist"]}},
    )


@pytest.mark.parametrize(
    "broken",
    [
        {"type": "Bad Type"},
        {"type": ""},
        {"id": "not-a-uuid"},
        {"schema_version": 0},
        {"schema_version": 40000},
        {"device_time": "yesterday"},
        {"payload": []},
        {"payload": "text"},
        {"gps": {"lat": 91, "lng": 0, "accuracy_m": 1}},
        {"gps": {"lat": 0, "lng": 0}},
        {"shift_id": "x"},
    ],
)
def test_a_malformed_envelope_is_a_validation_error_for_the_whole_batch(
    phone: Phone, broken: dict[str, Any]
) -> None:
    good = event()

    response = phone.sync([good, event(**broken)])

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert any(path.startswith("events.1") for path in response.data["fields"])
    assert not FieldEvent.objects.exists()


@pytest.mark.parametrize("missing", ["id", "type", "schema_version", "device_time", "payload"])
def test_a_missing_envelope_field_is_a_validation_error(phone: Phone, missing: str) -> None:
    broken = event()
    del broken[missing]

    response = phone.sync([broken])

    assert response.status_code == 400
    assert f"events.0.{missing}" in response.data["fields"]


@pytest.mark.parametrize("missing", ["device_id", "sent_at", "events"])
def test_a_missing_batch_field_is_a_validation_error(phone: Phone, missing: str) -> None:
    body = {"device_id": str(phone.device_id), "sent_at": timezone.now().isoformat(), "events": []}
    del body[missing]

    response = phone.client.post("/api/v1/field/sync/", body, format="json")

    assert response.status_code == 400
    assert missing in response.data["fields"]


def test_a_body_nested_too_deep_for_the_parser_is_a_parse_error_not_a_500(phone: Phone) -> None:
    response = phone.client.post(
        "/api/v1/field/sync/", "[" * 100_000, content_type="application/json"
    )

    assert response.status_code == 400
    assert response.data["code"] == "parse_error"
