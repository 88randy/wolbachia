"""Whole signed records are scoped before filters/count/page; transit is not on-hand."""

from decimal import Decimal
from typing import Any, cast

from django.db.models import Case, CharField, Exists, OuterRef, QuerySet, Value, When
from django.http import Http404
from rest_framework.filters import BaseFilterBackend
from rest_framework.request import Request

from inventory.transfers.custody import context_location
from inventory.transfers.models import Discrepancy, ResolutionOutcome, Transfer, TransferEvent
from inventory.transfers.scope import visible_transfers
from inventory.transfers.serializers import TransferQuerySerializer
from uploads.access import UploadActor, actor_from_request


def transfer_state(transfer: Transfer) -> str:
    if transfer.discrepancies.filter(resolution__isnull=False).exists():
        return "resolved"
    if transfer.discrepancies.filter(resolution__isnull=True).exists():
        return "discrepancy"
    kinds = set(transfer.events.values_list("kind", flat=True))
    return (
        "received" if "receive" in kinds else ("dispatched" if "dispatch" in kinds else "prepared")
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
        .select_related("transfer", "receipt_event")
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
    if not transfer.events.filter(kind="dispatch").exists():
        return {}
    received = (
        {
            str(row.line_id): row.quantity
            for row in transfer.events.get(kind="receive").receipt_lines.all()
        }
        if transfer.events.filter(kind="receive").exists()
        else {}
    )
    quantities = {
        str(line.pk): line.quantity - received.get(str(line.pk), Decimal(0))
        for line in transfer.lines.all()
    }
    for outcome in ResolutionOutcome.objects.filter(
        resolution__discrepancy__transfer=transfer, line__kind="missing"
    ).select_related("line"):
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
