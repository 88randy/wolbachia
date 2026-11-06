"""Real PostgreSQL arbitration, not sleep-based concurrency or SQLite substitutes."""

import threading
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest
from django.db import close_old_connections

from inventory.exceptions import InventoryConflictError, InventoryInProgressError
from inventory.models import LotAdmission, StockMovement
from inventory.permissions import ADMIN_CODES
from inventory.services import LotChange, revise_lot
from tests.inventory_support import allow_all, inventory_context
from uploads.access import UploadActor


@pytest.mark.django_db(transaction=True)
def test_contending_admissions_rollback_retry_then_preserve_one_opening_credit(
    org_a, make_member, monkeypatch
):
    from inventory import services

    context = inventory_context(org_a, make_member)
    draft = revise_lot(
        LotChange(
            context.actor,
            {
                "code": "CONCURRENT-ADMISSION",
                "supply_id": context.supply.pk,
                "initial_location_id": context.location.pk,
                "provenance": "Synthetic pending admission",
            },
        )
    )
    other_user, other_member = make_member(org_a, ADMIN_CODES)
    allow_all(other_member)
    contender = UploadActor(other_user, org_a)
    reached, release = threading.Event(), threading.Event()
    original = services._retain_lot_identity

    def parked(*args):
        original(*args)
        if threading.current_thread().name.startswith("inventory-winner"):
            reached.set()
            assert release.wait(timeout=10)

    monkeypatch.setattr(services, "_retain_lot_identity", parked)

    def winner():
        close_old_connections()
        try:
            return revise_lot(
                LotChange(context.actor, {"quantity": Decimal("2")}, draft.lot_id, 1)
            ).pk
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="inventory-winner") as pool:
        future = pool.submit(winner)
        try:
            assert reached.wait(timeout=10)
            with pytest.raises(InventoryInProgressError):
                revise_lot(LotChange(contender, {"quantity": Decimal("2")}, draft.lot_id, 1))
        finally:
            release.set()
        assert future.result(timeout=10)
    with pytest.raises(InventoryConflictError, match="conflicts"):
        revise_lot(LotChange(contender, {"quantity": Decimal("2")}, draft.lot_id, 1))
    assert LotAdmission.objects.filter(lot=draft.lot).count() == 1
    assert list(StockMovement.objects.filter(lot=draft.lot).values_list("quantity", flat=True)) == [
        Decimal("2")
    ]


@pytest.mark.django_db(transaction=True)
def test_condition_source_contender_retries_to_exact_original_incident(
    org_a, make_member, monkeypatch
):
    from dataclasses import replace

    from inventory import conditions
    from inventory.models import ConditionIncidentLink, ConditionReading
    from tests.inventory_support import AT, biological_context, capture

    context = biological_context(org_a, make_member, monkeypatch)
    other_user, other_member = make_member(org_a, ADMIN_CODES)
    allow_all(other_member)
    request = capture(context, AT, "21", "35")
    contender = replace(request, actor=UploadActor(other_user, org_a))
    reached, release = threading.Event(), threading.Event()
    original = conditions._new_reading

    def parked(*args):
        if threading.current_thread().name.startswith("condition-winner"):
            reached.set()
            assert release.wait(timeout=10)
        return original(*args)

    monkeypatch.setattr(conditions, "_new_reading", parked)

    def winner():
        close_old_connections()
        try:
            return conditions.record_condition(request).pk
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="condition-winner") as pool:
        future = pool.submit(winner)
        try:
            assert reached.wait(timeout=10)
            with pytest.raises(InventoryInProgressError):
                conditions.record_condition(contender)
        finally:
            release.set()
        identifier = future.result(timeout=10)
    replay = conditions.record_condition(contender)
    assert replay.pk == identifier
    assert ConditionReading.objects.filter(lot=context.lot).count() == 1
    assert ConditionIncidentLink.objects.filter(breach__reading=replay).count() == 1


@pytest.mark.django_db
def test_scope_revocation_refuses_revision_without_stock_or_history_effects(org_a, make_member):
    from rest_framework.exceptions import PermissionDenied

    context = inventory_context(org_a, make_member)
    context.profile.permission_codes = []
    context.profile.save(update_fields=["permission_codes"])
    with pytest.raises(PermissionDenied):
        revise_lot(
            LotChange(
                context.actor, {"observations": "Refused after permission loss"}, context.lot.pk, 1
            )
        )
    assert context.lot.versions.count() == 1
    assert StockMovement.objects.filter(lot=context.lot).count() == 1
