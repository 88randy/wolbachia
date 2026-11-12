"""`GET /shifts/` and `GET /shifts/{id}/`: isolation, permission, filters and the shape."""

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from rest_framework.test import APIClient

from organizations.models import Organization
from shifts.models import CheckResult, MotorcycleCheck, ShiftStatus
from shifts.permissions import SHIFT_READ
from tests.conftest import MemberFactory
from tests.factories import CatalogItemFactory, ShiftFactory

pytestmark = pytest.mark.django_db

SHIFTS = "/api/v1/shifts/"
MEXICO_CITY = ZoneInfo("America/Mexico_City")


def supervisor_client(
    organization: Organization,
    make_member: MemberFactory,
    codes: tuple[str, ...] = (SHIFT_READ,),
) -> APIClient:
    from tests.fleet_support import grant_fleet_scope

    user, _ = grant_fleet_scope(make_member(organization, codes))
    client = APIClient()
    client.force_authenticate(user)
    return client


def ids(response: Any) -> list[str]:  # noqa: ANN401
    assert response.status_code == 200, response.data
    return [str(item["id"]) for item in response.data["results"]]


def test_a_supervisor_lists_the_shifts_of_the_organization_newest_first(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    now = datetime.now(tz=MEXICO_CITY)
    older = ShiftFactory(organization=org_a, opened_at_device=now - timedelta(days=1))
    newer = ShiftFactory(organization=org_a, opened_at_device=now)
    ShiftFactory(organization=org_b)
    client = supervisor_client(org_a, make_member)

    response = client.get(SHIFTS)

    assert ids(response) == [str(newer.pk), str(older.pk)]
    assert response.data["count"] == 2


def test_the_detail_carries_the_motorcycle_odometers_and_checklist(
    org_a: Organization, make_member: MemberFactory
) -> None:
    shift = ShiftFactory(
        organization=org_a, is_closed=True, odometer_open_km=12_000, odometer_close_km=12_090
    )
    item = CatalogItemFactory(catalog__organization=org_a, organization=org_a, code="brakes")
    MotorcycleCheck.objects.create(
        organization=org_a, shift=shift, item=item, result=CheckResult.MINOR, note="squeaks"
    )
    client = supervisor_client(org_a, make_member)

    response = client.get(f"{SHIFTS}{shift.pk}/")

    assert response.status_code == 200
    body = response.data
    assert (body["status"], body["motorcycle_code"]) == ("closed", shift.motorcycle.code)
    assert (body["odometer_open_km"], body["odometer_close_km"]) == (12_000, 12_090)
    assert body["courier"] == shift.courier_id
    assert [(c["item_code"], c["result"], c["note"]) for c in body["checks"]] == [
        ("brakes", "minor", "squeaks")
    ]
    assert str(body["opened_event"]) == str(shift.opened_event_id)
    assert set(body) == {
        "id",
        "code",
        "courier",
        "device",
        "motorcycle",
        "motorcycle_code",
        "status",
        "opened_at_device",
        "opened_event",
        "odometer_open_km",
        "open_note",
        "closed_at_device",
        "closed_event",
        "odometer_close_km",
        "close_note",
        "checks",
        "created_at",
        "validation",
        "validation_timeline",
    }


def test_a_shift_of_another_organization_is_404(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    foreign = ShiftFactory(organization=org_b)
    client = supervisor_client(org_a, make_member)

    response = client.get(f"{SHIFTS}{foreign.pk}/")

    assert response.status_code == 404
    assert response.data["code"] == "not_found"


@pytest.mark.parametrize("path", ["", "00000000-0000-4000-8000-000000000000/"])
def test_without_shift_read_the_answer_is_403(
    org_a: Organization, make_member: MemberFactory, path: str
) -> None:
    client = supervisor_client(org_a, make_member, codes=("catalog.read",))

    response = client.get(f"{SHIFTS}{path}")

    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"


def test_an_anonymous_request_is_401() -> None:
    assert APIClient().get(SHIFTS).status_code == 401


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_shifts_cannot_be_written_through_the_api(
    org_a: Organization, make_member: MemberFactory, method: str
) -> None:
    shift = ShiftFactory(organization=org_a)
    client = supervisor_client(org_a, make_member)

    response = getattr(client, method)(f"{SHIFTS}{shift.pk}/", {}, format="json")

    assert response.status_code == 405


def test_the_list_filters_by_status_and_courier(
    org_a: Organization, make_member: MemberFactory
) -> None:
    open_shift = ShiftFactory(organization=org_a)
    closed_shift = ShiftFactory(organization=org_a, is_closed=True)
    client = supervisor_client(org_a, make_member)

    by_status = client.get(SHIFTS, {"status": ShiftStatus.CLOSED})
    by_courier = client.get(SHIFTS, {"courier": str(open_shift.courier_id)})

    assert ids(by_status) == [str(closed_shift.pk)]
    assert ids(by_courier) == [str(open_shift.pk)]


def test_the_date_range_is_inclusive_and_uses_the_organization_time_zone(
    org_a: Organization, make_member: MemberFactory
) -> None:
    late_night = datetime(2026, 11, 9, 23, 30, tzinfo=MEXICO_CITY)  # already Nov 10 in UTC
    next_day = datetime(2026, 11, 10, 0, 5, tzinfo=MEXICO_CITY)
    day_after = datetime(2026, 11, 11, 8, 0, tzinfo=MEXICO_CITY)
    a = ShiftFactory(organization=org_a, opened_at_device=late_night)
    b = ShiftFactory(organization=org_a, opened_at_device=next_day)
    ShiftFactory(organization=org_a, opened_at_device=day_after)
    client = supervisor_client(org_a, make_member)

    only_ninth = client.get(SHIFTS, {"date_from": "2026-11-09", "date_to": "2026-11-09"})
    ninth_and_tenth = client.get(SHIFTS, {"date_from": "2026-11-09", "date_to": "2026-11-10"})
    from_tenth = client.get(SHIFTS, {"date_from": "2026-11-10", "date_to": "2026-11-10"})

    assert ids(only_ninth) == [str(a.pk)]
    assert ids(ninth_and_tenth) == [str(b.pk), str(a.pk)]
    assert ids(from_tenth) == [str(b.pk)]


@pytest.mark.parametrize(
    ("query", "field", "code"),
    [
        ({"status": "paused"}, "status", "invalid_choice"),
        ({"courier": "x"}, "courier", "invalid"),
        ({"date_from": "yesterday"}, "date_from", "invalid"),
        ({"date_from": "2026-11-10", "date_to": "2026-11-09"}, "date_to", "date_range_inverted"),
    ],
)
def test_an_invalid_filter_is_a_validation_error(
    org_a: Organization, make_member: MemberFactory, query: dict[str, str], field: str, code: str
) -> None:
    client = supervisor_client(org_a, make_member)

    response = client.get(SHIFTS, query)

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert response.data["fields"][field][0]["code"] == code


def test_the_list_is_paged_by_page_number(org_a: Organization, make_member: MemberFactory) -> None:
    for _ in range(3):
        ShiftFactory(organization=org_a)
    client = supervisor_client(org_a, make_member)

    response = client.get(SHIFTS, {"page_size": 2})

    assert response.data["count"] == 3
    assert len(response.data["results"]) == 2
    assert response.data["next"] is not None


def test_a_scoped_supervisor_still_cannot_see_a_shift_outside_their_scope(
    org_a: Organization, make_member: MemberFactory
) -> None:
    from organizations.models import Center
    from tests.factories import MotorcycleFactory

    mine = Center.objects.create(organization=org_a, code="MINE", name="Mine")
    other = Center.objects.create(organization=org_a, code="OTHER", name="Other")
    visible = ShiftFactory(
        organization=org_a, motorcycle=MotorcycleFactory(organization=org_a, center=mine)
    )
    hidden = ShiftFactory(
        organization=org_a, motorcycle=MotorcycleFactory(organization=org_a, center=other)
    )
    user, membership = make_member(org_a, (SHIFT_READ,))
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

    for query in ("", "?status=open", "?status=closed"):
        found = ids(client.get(SHIFTS + query))
        assert str(hidden.pk) not in found
    assert str(visible.pk) in ids(client.get(SHIFTS))


def test_an_organization_wide_reader_lists_shifts_in_constant_queries(
    org_a: Organization, make_member: MemberFactory, django_assert_max_num_queries: Any
) -> None:
    """Regression: the list replayed the events of every shift, row by row (about 20 s on QA)."""
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    ShiftFactory(organization=org_a)
    client = supervisor_client(org_a, make_member)
    with CaptureQueriesContext(connection) as few:
        assert len(ids(client.get(SHIFTS))) == 1
    for _ in range(8):
        ShiftFactory(organization=org_a, is_closed=True)
    with django_assert_max_num_queries(len(few)):
        assert len(ids(client.get(SHIFTS))) == 9


def test_a_scoped_reader_runs_the_exact_check_only_on_shifts_of_their_centers(
    org_a: Organization, make_member: MemberFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    from organizations.models import Center
    from shifts import validation
    from tests.factories import MotorcycleFactory

    mine = Center.objects.create(organization=org_a, code="MINE", name="Mine")
    other = Center.objects.create(organization=org_a, code="OTHER", name="Other")
    visible = ShiftFactory(
        organization=org_a, motorcycle=MotorcycleFactory(organization=org_a, center=mine)
    )
    for _ in range(4):
        ShiftFactory(
            organization=org_a, motorcycle=MotorcycleFactory(organization=org_a, center=other)
        )
    user, membership = make_member(org_a, (SHIFT_READ,))
    scope = {
        "centers": {"mode": "selected", "ids": [str(mine.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    membership.scope = scope
    membership.save(update_fields=["scope"])
    for profile in membership.profiles.all():
        profile.scope = scope
        profile.save(update_fields=["scope"])
    checked: list[str] = []
    exact = validation.shift_scope_allows

    def counting(scope_: Any, shift: Any, permission: str) -> bool:  # noqa: ANN401
        checked.append(str(shift.pk))
        return exact(scope_, shift, permission)

    monkeypatch.setattr(validation, "shift_scope_allows", counting)
    client = APIClient()
    client.force_authenticate(user)

    assert ids(client.get(SHIFTS)) == [str(visible.pk)]
    assert checked == [str(visible.pk)]
