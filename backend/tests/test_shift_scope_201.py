"""#201: current paired sync grants authorize the motorcycle before exposing its state."""

import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import connection, transaction

from field_sync.permissions import FIELD_EVENT_SYNC
from organizations.models import Center, all_scope
from shifts.models import Motorcycle, MotorcycleBlockEvent, MotorcycleCheck, Shift
from tests.factories import MotorcycleFactory, ProfileFactory
from tests.shift_support import open_event
from tests.sync_support import make_phone


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("center_mode", "target", "has_unrelated_all_grant", "expected_status"),
    [
        ("selected", "assigned", False, "accepted"),
        ("selected", "other", False, "rejected"),
        ("selected", "unassigned", False, "rejected"),
        ("all", "unassigned", False, "accepted"),
        ("none", "assigned", False, "rejected"),
        ("empty", "assigned", False, "rejected"),
        ("none", "unassigned", False, "rejected"),
        ("selected", "other", True, "rejected"),
    ],
)
def test_shift_open_uses_current_paired_sync_scope_without_disclosing_unavailable_motorcycles(
    org_a, make_member, center_mode, target, has_unrelated_all_grant, expected_status
):
    assigned = Center.objects.create(organization=org_a, code="A", name="Assigned center")
    other = Center.objects.create(organization=org_a, code="B", name="Other center")
    motorcycle = MotorcycleFactory(
        organization=org_a,
        center={"assigned": assigned, "other": other, "unassigned": None}[target],
        is_blocked=target == "other",
        blocked_reason="service_overdue" if target == "other" else "",
    )
    phone = make_phone(make_member, org_a, (FIELD_EVENT_SYNC,))
    pending = open_event(motorcycle.code, payload_checks=[])
    membership = phone.user.memberships.get(organization=org_a)
    profile = membership.profiles.get()
    selected_scope = {
        "centers": {
            "mode": "selected" if center_mode == "empty" else center_mode,
            "ids": [str(assigned.pk)] if center_mode == "selected" else [],
        },
        "quadrants": {"mode": "none" if target == "assigned" else "all", "ids": []},
    }
    # The phone already has the event; authorization uses the current server grant.
    membership.scope = all_scope() if has_unrelated_all_grant else selected_scope
    membership.save(update_fields=["scope"])
    profile.scope = selected_scope if has_unrelated_all_grant else all_scope()
    profile.save(update_fields=["scope"])
    if has_unrelated_all_grant:
        membership.profiles.add(
            ProfileFactory(
                organization=org_a, permission_codes=["motorcycle.read"], scope=all_scope()
            )
        )
    response = phone.sync([pending])

    assert response.status_code == 200, response.data
    (result,) = response.data["results"]
    assert (result["status"], result["code"], result["params"]) == (
        expected_status,
        "accepted" if expected_status == "accepted" else "motorcycle_unknown",
        {},
    )
    assert Shift.objects.filter(opened_event_id=pending["id"]).exists() == (
        expected_status == "accepted"
    )
    assert not MotorcycleCheck.objects.exists()
    assert not MotorcycleBlockEvent.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_locked_out_of_scope_motorcycle_has_the_same_answer_as_an_unknown_code(
    org_a, make_member, settings
):
    settings.SYNC_LOCK_TIMEOUT_MS = 100
    assigned = Center.objects.create(organization=org_a, code="A", name="Assigned center")
    other = Center.objects.create(organization=org_a, code="B", name="Other center")
    motorcycle = MotorcycleFactory(organization=org_a, center=other)
    phone = make_phone(make_member, org_a)
    membership = phone.user.memberships.get(organization=org_a)
    membership.scope = {
        "centers": {"mode": "selected", "ids": [str(assigned.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    membership.save(update_fields=["scope"])
    profile = membership.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    lock_acquired = threading.Barrier(2, timeout=10)
    release = threading.Event()

    def hold_motorcycle_lock():
        try:
            with transaction.atomic():
                Motorcycle.objects.select_for_update().get(pk=motorcycle.pk)
                lock_acquired.wait()
                assert release.wait(timeout=10), "test did not release motorcycle lock"
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as executor:
        holder = executor.submit(hold_motorcycle_lock)
        try:
            lock_acquired.wait()
            unknown = phone.sync([open_event("UNKNOWN", payload_checks=[])])
            out_of_scope = phone.sync([open_event(motorcycle.code, payload_checks=[])])
            assert unknown.status_code == out_of_scope.status_code == 200
            for response in (unknown, out_of_scope):
                (result,) = response.data["results"]
                assert (result["status"], result["code"], result["params"]) == (
                    "rejected",
                    "motorcycle_unknown",
                    {},
                )
        finally:
            release.set()
            holder.result(timeout=10)

    assert not Shift.objects.exists()
    assert not MotorcycleCheck.objects.exists()
    assert not MotorcycleBlockEvent.objects.exists()
