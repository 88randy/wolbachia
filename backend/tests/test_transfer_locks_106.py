"""The common organization arbiter serializes affordable custody, not client line order."""

import threading
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest
from django.db import close_old_connections
from django.db.models import Sum

from inventory.exceptions import InventoryConflictError, InventoryInProgressError
from inventory.models import StockMovement
from inventory.services import LotChange, revise_lot
from inventory.transfers.commands import PrepareTransferCommand
from inventory.transfers.models import TransferEvent
from inventory.transfers.services import dispatch_transfer, prepare_transfer
from tests.inventory_support import allow_all
from tests.test_inventory_transfers_106 import (
    TRANSFER_CODES,
    dispatch_request,
)
from tests.test_inventory_transfers_106 import (
    custody as custody_fixture,
)
from uploads.access import UploadActor

custody = custody_fixture  # pytest registers the shared fixture under this local name.


@pytest.mark.django_db(transaction=True)
def test_two_multiline_dispatches_cannot_overspend_or_leave_partial_evidence(
    custody, make_member, monkeypatch
):
    from inventory.transfers import transitions

    context, destination = custody
    second = revise_lot(
        LotChange(
            context.actor,
            {
                "code": "SECOND-RACE-LOT",
                "supply_id": context.supply.pk,
                "initial_location_id": context.location.pk,
                "quantity": Decimal("5"),
                "provenance": "Synthetic shared custody race",
            },
        )
    )
    lots = (context.lot, second.lot)
    rows = [
        {
            "lot_id": lot.pk,
            "piece_id": None,
            "quantity": Decimal("4"),
            "unit_version_id": context.supply_version.pk,
        }
        for lot in lots
    ]
    transfers = [
        prepare_transfer(
            PrepareTransferCommand(
                context.actor,
                {
                    "code": code,
                    "origin_id": context.location.pk,
                    "destination_id": destination.pk,
                    "lines": rows if number == 0 else list(reversed(rows)),
                },
            )
        )
        for number, code in enumerate(("LOCK-WINNER", "LOCK-CONTENDER"))
    ]
    user, member = make_member(context.actor.organization, (*TRANSFER_CODES, "field.upload"))
    allow_all(member)
    requests = (
        dispatch_request(context.actor, transfers[0]),
        dispatch_request(UploadActor(user, context.actor.organization), transfers[1]),
    )
    reached, release = threading.Event(), threading.Event()
    append = transitions.append_stock

    def parked(event, legs):
        if threading.current_thread().name.startswith("transfer-winner"):
            reached.set()
            assert release.wait(timeout=10)
        append(event, legs)

    monkeypatch.setattr(transitions, "append_stock", parked)

    def winner():
        close_old_connections()
        try:
            return dispatch_transfer(requests[0]).event.pk
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="transfer-winner") as pool:
        future = pool.submit(winner)
        try:
            assert reached.wait(timeout=10), "winner never retained Org/domain/upload locks"
            with pytest.raises(InventoryInProgressError):
                dispatch_transfer(requests[1])
        finally:
            release.set()
        winning_id = future.result(timeout=10)
    with pytest.raises(InventoryConflictError):
        dispatch_transfer(requests[1])
    assert TransferEvent.objects.filter(transfer=transfers[1].event.transfer).count() == 1
    assert not TransferEvent.objects.filter(
        transfer=transfers[1].event.transfer, evidence_refs__isnull=False
    ).exists()
    assert TransferEvent.objects.get(pk=winning_id).stock_effects.count() == 2
    for lot in lots:
        assert (
            StockMovement.objects.filter(lot=lot, location=context.location).aggregate(
                total=Sum("quantity")
            )["total"]
            == 1
        )


@pytest.mark.django_db(transaction=True)
def test_action_lost_between_preflight_and_org_lock_is_rechecked_before_write(custody, monkeypatch):
    from contextlib import contextmanager

    from rest_framework.exceptions import PermissionDenied

    from inventory.transfers import services
    from tests.test_inventory_transfers_106 import prepared

    context, _ = custody
    request = dispatch_request(context.actor, prepared(custody))
    actual = services.transfer_transaction
    reached, release = threading.Event(), threading.Event()

    @contextmanager
    def parked(*args, **kwargs):
        reached.set()
        assert release.wait(timeout=10)
        with actual(*args, **kwargs) as organization:
            yield organization

    monkeypatch.setattr(services, "transfer_transaction", parked)

    def contender():
        close_old_connections()
        try:
            return dispatch_transfer(request)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(contender)
        try:
            assert reached.wait(timeout=10)
            # A committed current authorization change before the common arbiter.
            context.profile.permission_codes.remove("transfer.dispatch")
            context.profile.save(update_fields=["permission_codes"])
        finally:
            release.set()
        with pytest.raises(PermissionDenied):
            future.result(timeout=10)
    assert not TransferEvent.objects.filter(
        transfer_id=request.transfer_id, kind="dispatch"
    ).exists()
