"""Source and correction dependencies retain audit facts or refuse, never erase them."""

from typing import Any
from uuid import UUID

from django.db import DatabaseError, connection, transaction
from django.db.models import OuterRef, Subquery

from field_sync.models import FieldEvent
from lab.models import LabResultRevision


def source_lab_blockers(source: FieldEvent) -> list[dict[str, Any]]:
    from ovitraps.models import Bag

    latest = LabResultRevision.objects.filter(bag=OuterRef("pk")).order_by("-revision")
    bags = Bag.objects.filter(organization=source.organization, event=source).annotate(
        current_count=Subquery(latest.values("count_id")[:1]),
        current_rejection=Subquery(latest.values("rejection_id")[:1]),
    )
    return [
        {"reason": "lab_result_active", "unblocked_by_role": "supervisor", "link": ""}
        for bag in bags
        if bag.current_count is not None or bag.current_rejection is not None
    ]


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
