"""What the courier phone must refresh after the warehouse changes a delivery (release)."""

from uuid import UUID, uuid4

import pytest

from tests.test_delivery_signature_receipt import _cancel_release, _signed_release
from tests.test_inventory_allocations_b_10 import allocation  # noqa: F401  (fixture)

BOOTSTRAP = "/api/v1/field/bootstrap/"


def _bootstrap(allocation):  # noqa: F811
    response = allocation.phone.client.get(BOOTSTRAP)
    assert response.status_code == 200
    return response


def _supply(response, assignment_id):
    (row,) = [row for row in response.data["supplies"] if row["id"] == str(assignment_id)]
    return row


def _courier_changes(allocation):  # noqa: F811
    from field_sync.models import CourierChange

    return CourierChange.objects.filter(
        courier=allocation.phone.user, kind="supplies", resource_id=str(allocation.assignment_id)
    ).order_by("sequence")


@pytest.mark.django_db
def test_cancelling_a_release_changes_the_bundle_and_drops_it_from_what_the_phone_can_receive(
    allocation,  # noqa: F811
    void_catalog,
):
    before = _bootstrap(allocation)
    assert [row["id"] for row in _supply(before, allocation.assignment_id)["releases"]] == [
        str(allocation.release_id)
    ]
    changes_before = _courier_changes(allocation).count()

    _cancel_release(allocation, allocation.release_id)

    after = _bootstrap(allocation)
    assert after["ETag"] != before["ETag"]
    row = _supply(after, allocation.assignment_id)
    assert row["releases"] == []
    assert row["lifecycle"]["status"] == "cancelled"
    assert _courier_changes(allocation).count() == changes_before + 1
    assert _courier_changes(allocation).last().payload["releases"] == []


@pytest.mark.django_db
def test_a_replacement_release_is_the_only_one_the_phone_sees(allocation, void_catalog):  # noqa: F811
    cancelled = allocation.release_id
    replacement = _signed_release(allocation)

    row = _supply(_bootstrap(allocation), allocation.assignment_id)

    assert [release["id"] for release in row["releases"]] == [str(replacement)]
    assert str(cancelled) not in {release["id"] for release in row["releases"]}
    assert row["releases"][0]["warehouse_signed"] is True
    assert row["lifecycle"]["status"] == "released"


@pytest.mark.django_db
def test_editing_the_plan_moves_the_revision_and_the_bundle(allocation, void_catalog):  # noqa: F811
    from inventory.allocations.commands import AssignmentWrite
    from inventory.allocations.models import SupplyAssignmentLine
    from inventory.allocations.services import write_assignment
    from tests.inventory_support import AT

    _cancel_release(allocation, allocation.release_id)
    before = _bootstrap(allocation)
    line = SupplyAssignmentLine.objects.get(pk=allocation.line_id)
    write_assignment(
        AssignmentWrite(
            allocation.context.actor,
            {
                "command_id": uuid4(),
                "expected_revision": 1,
                "courier_id": allocation.phone.user.pk,
                "origin_id": line.version.assignment.origin_id,
                "date": AT.date(),
                "shift_id": allocation.shift_id,
                "lines": [
                    {
                        "id": uuid4(),
                        "lot_id": line.lot_id,
                        "piece_id": line.piece_id,
                        "unit_version_id": line.unit_version_id,
                        "quantity": line.quantity - 1,
                    }
                ],
            },
            allocation.assignment_id,
        )
    )

    after = _bootstrap(allocation)

    assert after["ETag"] != before["ETag"]
    assert _supply(before, allocation.assignment_id)["revision"] == 1
    assert _supply(after, allocation.assignment_id)["revision"] == 2


@pytest.mark.django_db
def test_replaying_a_cancel_or_reading_again_does_not_change_the_bundle(allocation, void_catalog):  # noqa: F811
    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent

    actor = allocation.context.actor
    body = {
        "command_id": uuid4(),
        "kind": "release_cancel",
        "release_id": allocation.release_id,
        "expected_revision": 1,
        "evidence": [],
        "reason_code": "other",
        "reason": "Synthetic correction before the signed release",
    }
    prepared = prepare_inventory_intent(actor, body)
    execution = IntentExecution(
        UUID(prepared.body["intent"]["id"]), "release_cancel", allocation.assignment_id
    )
    execute_inventory_intent(actor, execution)
    first = _bootstrap(allocation)
    changes = _courier_changes(allocation).count()

    execute_inventory_intent(actor, execution)
    second = _bootstrap(allocation)

    assert second["ETag"] == first["ETag"]
    assert _courier_changes(allocation).count() == changes
