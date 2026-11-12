"""The receipt from the courier phone, after the warehouse screen signed the release."""

from datetime import timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from tests.test_inventory_allocations_b_10 import allocation  # noqa: F401  (fixture)


def _set_mode(organization, value):
    from rules.models import RuleParameter, RuleParameterVersion, Unit, ValueType
    from tests.inventory_support import AT

    parameter, _ = RuleParameter.objects.get_or_create(
        organization=organization,
        key="delivery_signature_mode",
        defaults={
            "value_type": ValueType.INTEGER,
            "unit": Unit.COUNT,
            "min_value": Decimal(0),
            "max_value": Decimal(2),
        },
    )
    RuleParameterVersion.objects.create(
        organization=organization,
        parameter=parameter,
        value=Decimal(value),
        effective_from=AT - timedelta(days=1),
        effective_date=(AT - timedelta(days=1)).date(),
        reason="Synthetic delivery signature mode",
    )


def _signed_release(allocation):  # noqa: F811
    """Void the unsigned release (no stock moved), then release the same plan with a signature."""
    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from tests.test_inventory_transfers_106 import verified_upload
    from uploads.models import AttachmentLink, Upload

    actor = allocation.context.actor
    cancel = prepare_inventory_intent(
        actor,
        {
            "command_id": uuid4(),
            "kind": "release_cancel",
            "release_id": allocation.release_id,
            "expected_revision": 1,
            "evidence": [],
            "reason_code": "other",
            "reason": "Synthetic correction before the signed release",
        },
    )
    execute_inventory_intent(
        actor,
        IntentExecution(
            UUID(cancel.body["intent"]["id"]), "release_cancel", allocation.assignment_id
        ),
    )
    upload = verified_upload(actor)
    prepared = prepare_inventory_intent(
        actor,
        {
            "command_id": uuid4(),
            "kind": "assignment_release",
            "assignment_id": allocation.assignment_id,
            "expected_revision": 1,
            "evidence": [{"upload_id": upload, "role": "signature"}],
        },
    )
    intent_id = UUID(prepared.body["intent"]["id"])
    AttachmentLink.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        upload=Upload.objects.get(public_id=upload),
        inventory_intent_id=intent_id,
    )
    released = execute_inventory_intent(
        actor, IntentExecution(intent_id, "assignment_release", allocation.assignment_id)
    )
    return UUID(released.body["release"]["id"])


def _release_again_with_warehouse_signature(allocation):  # noqa: F811
    from inventory.allocations.models import OriginReleaseProof

    release_id = _signed_release(allocation)
    proof = OriginReleaseProof.objects.get(pk=release_id).proof
    assert proof["signature"]["channel"] == "warehouse_screen"
    return release_id


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("mode", "accepted"),
    [(0, True), (1, True), (2, False)],
    ids=["either-accepts", "warehouse-accepts", "phone-rejects"],
)
def test_a_receipt_without_its_own_signature_needs_a_warehouse_signed_release_in_mode_0_or_1(
    allocation,  # noqa: F811
    void_catalog,
    mode,
    accepted,
):
    from inventory.allocations.models import OriginReleaseLine, SupplyReceipt
    from tests.sync_support import event

    release_id = _release_again_with_warehouse_signature(allocation)
    _set_mode(allocation.context.actor.organization, mode)
    release_line = OriginReleaseLine.objects.get(release_id=release_id)
    capture = event(
        type="supplies.receive",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 0,
            "plan_revision": 1,
            "release_id": str(release_id),
            "signature_upload_id": None,
            "actual_lines": [
                {"id": str(uuid4()), "release_line_id": str(release_line.pk), "quantity": "8"}
            ],
            "discrepancies": [],
        },
    )
    result = allocation.phone.sync([capture]).data["results"][0]
    if accepted:
        assert result["status"] == "accepted"
        assert SupplyReceipt.objects.get().signature is None
    else:
        assert result["status"] != "accepted"
        assert "supply_signature_required" in str(result)
        assert not SupplyReceipt.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "forged",
    [None, False, "", {"channel": "courier_device"}],
    ids=["json-null", "false", "empty-text", "phone-channel"],
)
def test_the_database_refuses_an_unsigned_receipt_unless_the_release_holds_a_warehouse_signature(
    allocation,  # noqa: F811
    void_catalog,
    monkeypatch,
    forged,
):
    """Defense in depth: with the handler check bypassed, the trigger alone refuses a receipt
    without its own signature when the release's `signature` is not the warehouse-screen one."""
    from inventory.allocations import signature_mode
    from inventory.allocations.models import OriginReleaseLine, OriginReleaseProof, SupplyReceipt
    from tests.sync_support import event

    manager = OriginReleaseProof.objects
    create = manager.create

    def forging(**values):
        values["proof"] = {**values["proof"], "signature": forged}
        return create(**values)

    monkeypatch.setattr(manager, "create", forging)
    release_id = _signed_release(allocation)
    monkeypatch.setattr(manager, "create", create)
    assert OriginReleaseProof.objects.get(pk=release_id).proof["signature"] == forged
    monkeypatch.setattr(signature_mode, "receipt_signature_problem", lambda *_: None)
    release_line = OriginReleaseLine.objects.get(release_id=release_id)
    capture = event(
        type="supplies.receive",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 0,
            "plan_revision": 1,
            "release_id": str(release_id),
            "signature_upload_id": None,
            "actual_lines": [
                {"id": str(uuid4()), "release_line_id": str(release_line.pk), "quantity": "8"}
            ],
            "discrepancies": [],
        },
    )
    response = allocation.phone.sync([capture])
    # The trigger aborts the batch (an impossible state, so no event code exists for it).
    assert response.status_code == 500
    assert not SupplyReceipt.objects.exists()
