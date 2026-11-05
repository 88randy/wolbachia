"""The `shift_id` of an event is a real reference: missing or foreign shifts reject, a closed shift
reviews events captured after it closed (docs/sync.md "Shifts")."""

import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone

from catalogs.seeds import seed_default_catalogs
from field_sync import registry
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from organizations.models import Organization
from shifts.guard import check_event_shift
from tests.conftest import MemberFactory
from tests.factories import ShiftFactory
from tests.sync_support import Phone, event, make_phone
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


def only_result(response: Any) -> dict[str, Any]:  # noqa: ANN401
    assert response.status_code == 200, response.data
    (result,) = response.data["results"]
    return dict(result)


def test_an_event_of_an_open_shift_is_accepted(phone: Phone) -> None:
    shift = ShiftFactory(organization=phone.organization, courier=phone.user)

    result = only_result(phone.sync([event(shift_id=str(shift.pk))]))

    assert result["status"] == "accepted"


def test_an_event_without_a_shift_is_not_checked(phone: Phone) -> None:
    result = only_result(phone.sync([event()]))

    assert result["status"] == "accepted"


def test_an_event_naming_a_missing_shift_is_rejected_and_writes_nothing(phone: Phone) -> None:
    missing = uuid.uuid4()

    result = only_result(phone.sync([event(shift_id=str(missing))]))

    assert (result["status"], result["code"]) == ("rejected", "shift_not_open")
    assert result["params"] == {"shift_id": str(missing)}
    assert not Widget.objects.exists()


def test_an_event_naming_another_couriers_shift_is_rejected(
    phone: Phone, org_a: Organization
) -> None:
    shift = ShiftFactory(organization=org_a)

    result = only_result(phone.sync([event(shift_id=str(shift.pk))]))

    assert (result["status"], result["code"]) == ("rejected", "shift_not_open")


def test_an_event_naming_a_shift_of_another_organization_is_rejected(
    phone: Phone, org_b: Organization
) -> None:
    shift = ShiftFactory(organization=org_b, courier=phone.user)

    result = only_result(phone.sync([event(shift_id=str(shift.pk))]))

    assert (result["status"], result["code"]) == ("rejected", "shift_not_open")


def test_an_event_captured_before_the_shift_closed_is_accepted_even_if_it_arrives_later(
    phone: Phone,
) -> None:
    closed_at = timezone.now() - timedelta(hours=1)
    shift = ShiftFactory(
        organization=phone.organization,
        courier=phone.user,
        is_closed=True,
        closed_at_device=closed_at,
    )
    captured = (closed_at - timedelta(minutes=10)).isoformat()

    result = only_result(phone.sync([event(shift_id=str(shift.pk), device_time=captured)]))

    assert result["status"] == "accepted"


def test_an_event_captured_after_the_shift_closed_is_applied_but_goes_to_review(
    phone: Phone,
) -> None:
    closed_at = timezone.now() - timedelta(hours=2)
    shift = ShiftFactory(
        organization=phone.organization,
        courier=phone.user,
        is_closed=True,
        closed_at_device=closed_at,
    )
    captured = (closed_at + timedelta(minutes=10)).isoformat()

    result = only_result(phone.sync([event(shift_id=str(shift.pk), device_time=captured)]))

    assert (result["status"], result["code"]) == ("in_review", "captured_after_shift_close")
    assert result["params"] == {"shift_id": str(shift.pk)}
    assert Widget.objects.count() == 1


def test_a_void_may_name_any_shift_because_it_corrects_an_old_event(phone: Phone) -> None:
    target = event()
    phone.sync([target])
    seed_default_catalogs(phone.organization)
    void = event(
        type="record.void",
        payload={"reason_code": "other", "reason": "a typo in the value"},
        voids_event_id=target["id"],
        shift_id=str(uuid.uuid4()),
    )

    result = only_result(phone.sync([void]))

    assert result["status"] == "accepted"
    assert FieldEvent.objects.get(pk=target["id"]).voided_at is not None


def test_only_the_shift_events_and_the_void_opt_out_of_the_shift_check() -> None:
    from field_sync.registry import HANDLERS

    opted_out = {key[0] for key, handler in HANDLERS.items() if not handler.checks_shift}

    assert opted_out == {"shift.open", "shift.close", "record.void"}


def test_without_a_registered_envelope_check_the_shift_id_is_not_validated(
    phone: Phone, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(registry, "ENVELOPE_CHECKS", [])

    result = only_result(phone.sync([event(shift_id=str(uuid.uuid4()))]))

    assert result["status"] == "accepted"


def test_registering_the_same_envelope_check_twice_raises() -> None:
    with pytest.raises(ImproperlyConfigured, match="already registered"):
        registry.register_envelope_check(check_event_shift)


def test_a_rejection_of_a_later_check_wins_over_a_review_signal_of_an_earlier_one(
    phone: Phone, monkeypatch: pytest.MonkeyPatch
) -> None:
    def asks_for_review(*args: object) -> EventNeedsReview:
        return EventNeedsReview("first_check")

    def rejects(*args: object) -> None:
        raise EventRejected("second_check")

    monkeypatch.setattr(registry, "ENVELOPE_CHECKS", [asks_for_review, rejects])

    result = only_result(phone.sync([event()]))

    assert (result["status"], result["code"]) == ("rejected", "second_check")


def test_the_first_review_signal_wins_when_no_check_rejects(
    phone: Phone, monkeypatch: pytest.MonkeyPatch
) -> None:
    def review(code: str) -> registry.EnvelopeCheck:
        def check(*args: object) -> EventNeedsReview:
            return EventNeedsReview(code)

        return check

    monkeypatch.setattr(registry, "ENVELOPE_CHECKS", [review("first"), review("second")])

    result = only_result(phone.sync([event()]))

    assert (result["status"], result["code"]) == ("in_review", "first")
