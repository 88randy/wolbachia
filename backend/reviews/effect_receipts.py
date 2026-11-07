"""The single effective-source predicate; a decision alone is never an effect."""

from typing import Any

from django.db.models import F, Q, QuerySet

from field_sync.models import FieldEvent


def effective_effects(rows: QuerySet[Any], source: str = "") -> QuerySet[Any]:
    prefix = f"{source}__" if source else ""
    receipt = f"{prefix}review_effect_receipt__"
    applied = Q(**{f"{prefix}status": "accepted"}) | Q(
        **{f"{receipt}payload_sha256": F(f"{prefix}payload_sha256")}
    )
    return rows.filter(applied, **{f"{prefix}voided_at__isnull": True})


def is_effective(source: FieldEvent) -> bool:
    return effective_effects(FieldEvent.objects.filter(pk=source.pk)).exists()
