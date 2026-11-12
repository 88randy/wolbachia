"""Whole signed records are scoped before filters/count/page; transit is not on-hand."""

from decimal import Decimal
from typing import Any, cast

from django.db.models import Case, CharField, Exists, OuterRef, Prefetch, QuerySet, Value, When
from django.http import Http404
from rest_framework.filters import BaseFilterBackend
from rest_framework.request import Request

from inventory.transfers.custody import context_location
from inventory.transfers.models import (
    Discrepancy,
    Transfer,
    TransferEvent,
)
from inventory.transfers.scope import visible_transfers
from inventory.transfers.serializers import TransferQuerySerializer
from uploads.access import UploadActor, actor_from_request


def transfer_state(transfer: Transfer) -> str:
    """Reads `discrepancies` and `events` through `.all()`, so the list prefetch serves it."""
    discrepancies = list(transfer.discrepancies.all())
    resolved = [hasattr(discrepancy, "resolution") for discrepancy in discrepancies]
    if any(resolved):
        return "resolved"
    if discrepancies:
        return "discrepancy"
    kinds = {event.kind for event in transfer.events.all()}
    return (
        "received" if "receive" in kinds else ("dispatched" if "dispatch" in kinds else "prepared")
    )


def with_transfer_projection(rows: QuerySet[Any], prefix: str = "") -> QuerySet[Any]:
    """Everything `TransferSerializer` reads, loaded once for the page. `prefix` is the path to the
    transfer when the rows are not transfers (e.g. `transfer__` for discrepancies)."""
    events = TransferEvent.objects.select_related(
        "stock_operation", "resolution", "discrepancy"
    ).prefetch_related("receipt_lines")
    return rows.prefetch_related(
        f"{prefix}lines__lot",
        Prefetch(f"{prefix}events", queryset=events),
        f"{prefix}discrepancies__resolution__outcomes__line",
    )


def transfer_rows(actor: UploadActor, permission: str) -> QuerySet[Transfer]:
    events = TransferEvent.objects.filter(transfer_id=OuterRef("pk"))
    discrepancies = Discrepancy.objects.filter(transfer_id=OuterRef("pk"))
    query = (
        visible_transfers(actor, permission)
        .annotate(
            _received=Exists(events.filter(kind="receive")),
            _dispatched=Exists(events.filter(kind="dispatch")),
            _open=Exists(discrepancies.filter(resolution__isnull=True)),
            _resolved=Exists(discrepancies.filter(resolution__isnull=False)),
        )
        .annotate(
            current_state=Case(
                When(_resolved=True, then=Value("resolved")),
                When(_open=True, then=Value("discrepancy")),
                When(_received=True, then=Value("received")),
                When(_dispatched=True, then=Value("dispatched")),
                default=Value("prepared"),
                output_field=CharField(),
            )
        )
    )
    return cast(QuerySet[Transfer], query)


def discrepancy_rows(actor: UploadActor, permission: str) -> QuerySet[Discrepancy]:
    query = (
        Discrepancy.objects.filter(
            organization=actor.organization, transfer__in=visible_transfers(actor, permission)
        )
        .select_related("transfer", "receipt_event", "resolution__event__stock_operation")
        .prefetch_related("lines", "holds__lot", "holds__resolution")
        .annotate(
            current_status=Case(
                When(resolution__isnull=False, then=Value("closed")),
                default=Value("open"),
                output_field=CharField(),
            )
        )
    )
    return cast(QuerySet[Discrepancy], query)


def outstanding_custody(transfer: Transfer) -> dict[str, str]:
    events = list(transfer.events.all())
    if not any(event.kind == "dispatch" for event in events):
        return {}
    receipt = next((event for event in events if event.kind == "receive"), None)
    received = (
        {}
        if receipt is None
        else {str(row.line_id): row.quantity for row in receipt.receipt_lines.all()}
    )
    quantities = {
        str(line.pk): line.quantity - received.get(str(line.pk), Decimal(0))
        for line in transfer.lines.all()
    }
    for discrepancy in transfer.discrepancies.all():
        resolution = getattr(discrepancy, "resolution", None)
        if resolution is None:
            continue
        for outcome in resolution.outcomes.all():
            if outcome.line.kind != "missing":
                continue
            key = str(outcome.line.line_id)
            quantities[key] = quantities.get(key, Decimal(0)) - outcome.quantity
    return {
        key: format(quantity.normalize(), "f")
        for key, quantity in quantities.items()
        if quantity > 0
    }


class TransferTableFilter(BaseFilterBackend):
    def filter_queryset(
        self,
        request: Request,
        queryset: QuerySet[Any],
        view: Any,  # noqa: ANN401 -- DRF view protocol
    ) -> QuerySet[Any]:
        if view.action != "list":
            return queryset
        names = view.transfer_facets
        body = TransferQuerySerializer(
            data={key: request.query_params[key] for key in names if key in request.query_params}
        )
        body.is_valid(raise_exception=True)
        actor = actor_from_request(request)
        for name, value in body.validated_data.items():
            self._require_reference(actor, queryset, (name, value))
            queryset = queryset.filter(**{names[name]: value})
        return queryset.distinct()

    @staticmethod
    def _require_reference(
        actor: UploadActor, query: QuerySet[Any], reference: tuple[str, Any]
    ) -> None:
        name, identifier = reference
        if name in {"origin", "destination"}:
            context_location(actor, str(identifier), "transfer.read")
        if name == "lot":
            lookup = "lines__lot_id" if query.model is Transfer else "transfer__lines__lot_id"
            if not query.filter(**{lookup: identifier}).exists():
                raise Http404
        if name == "transfer" and not query.filter(transfer_id=identifier).exists():
            raise Http404

    def get_schema_operation_parameters(self, view: Any) -> list[dict[str, Any]]:  # noqa: ANN401 -- DRF schema protocol
        if getattr(view, "action", None) != "list":
            return []
        fields = TransferQuerySerializer().fields
        result = []
        for name in view.transfer_facets:
            field = fields[name]
            schema: dict[str, Any] = {"type": "string"}
            if hasattr(field, "choices"):
                schema["enum"] = list(field.choices)
            elif name.endswith("_from") or name.endswith("_before"):
                schema["format"] = "date-time"
            else:
                schema["format"] = "uuid"
            result.append({"name": name, "in": "query", "required": False, "schema": schema})
        return result
