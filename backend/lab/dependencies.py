"""Source and correction dependencies retain audit facts or refuse, never erase them."""

from typing import Any
from uuid import UUID

from django.db import DatabaseError, connection, transaction
from django.db.models import Exists, OuterRef, Subquery

from field_sync.models import FieldEvent
from lab.models import EggCountAttempt, LabResultRevision
from ovitraps.models import Bag


def require_physical_material(bag: Bag) -> None:
    from inventory.allocations.bag_dependencies import material_availability
    from lab.exceptions import LabConflictError

    if not material_availability(bag)["available"]:
        raise LabConflictError("bag_material_unavailable")


def require_historical_correction(
    bag: Bag, predecessor: EggCountAttempt | None, values: dict[str, Any]
) -> dict[str, Any]:
    from inventory.allocations.bag_dependencies import material_availability
    from lab.exceptions import LabConflictError

    if values.get("measurement_kind") != "data_correction":
        require_physical_material(bag)
        return {}
    if (
        predecessor is None
        or predecessor.bag_id != bag.pk
        or predecessor.receipt.reading_id != bag.reading_id
        or predecessor.source_proof.get("reading_id") != str(bag.reading_id)
        or predecessor.source_proof.get("source_event_id") != str(bag.reading.event_id)
        or str(values.get("method_version")) != str(predecessor.method_version_id)
    ):
        raise LabConflictError("lab_historical_measurement_required")
    return {
        "measurement_kind": "data_correction",
        "measurement_origin_id": str(predecessor.pk),
        "measurement_command_id": str(predecessor.command_id),
        "material_available": material_availability(bag)["available"],
    }


def source_lab_blockers(source: FieldEvent) -> list[dict[str, Any]]:
    from inventory.allocations.models import BagDisposition, SupplyUse
    from ovitraps.models import Bag

    latest = LabResultRevision.objects.filter(bag=OuterRef("pk")).order_by("-revision")
    bags = Bag.objects.filter(organization=source.organization, event=source).annotate(
        current_count=Subquery(latest.values("count_id")[:1]),
        current_rejection=Subquery(latest.values("rejection_id")[:1]),
        physically_disposed=Exists(BagDisposition.objects.filter(bag_id=OuterRef("pk"))),
    )
    blockers = [
        {"reason": "lab_result_active", "unblocked_by_role": "supervisor", "link": ""}
        for bag in bags
        if bag.current_count is not None
        or bag.current_rejection is not None
        or bag.physically_disposed
    ]
    if SupplyUse.objects.filter(work_source=source, event__void_audit__isnull=True).exists():
        blockers.append(
            {"reason": "supply_use_active", "unblocked_by_role": "supervisor", "link": ""}
        )
    return blockers


def check_source_void_completion(source_id: UUID) -> bool:
    """Flush ONLY Lab's source guard; map its marker outside the failed savepoint."""
    try:
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS lab_source_void_guard IMMEDIATE")
            cursor.execute("SET CONSTRAINTS lab_source_void_guard DEFERRED")
    except DatabaseError as error:
        cause = error.__cause__
        marker = getattr(getattr(cause, "diag", None), "constraint_name", None)
        detail = getattr(getattr(cause, "diag", None), "message_detail", None)
        if (
            getattr(cause, "sqlstate", None) == "23514"
            and marker == "lab_source_void_active"
            and detail == str(source_id)
        ):
            return False
        raise
    return True
