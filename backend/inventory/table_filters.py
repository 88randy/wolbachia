"""Explicit server facets, scoped references and stable nested ordering."""

from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers
from rest_framework.filters import BaseFilterBackend
from rest_framework.request import Request
from rest_framework.views import APIView

from inventory.access import require_scope
from inventory.models import Location, Lot, SupplyType
from inventory.serializers import InventoryQuerySerializer
from organizations.models import Center
from uploads.access import UploadActor, actor_from_request

RELATIONS = {"supply": SupplyType, "location": Location, "lot": Lot, "center": Center}


def validated_query(request: Request, names: tuple[str, ...]) -> dict[str, Any]:
    serializer = InventoryQuerySerializer(
        data={name: request.query_params[name] for name in names if name in request.query_params}
    )
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def require_relation(actor: UploadActor, reference: tuple[str, UUID], permission: str) -> None:
    name, identifier = reference
    record = RELATIONS[name].objects.filter(organization=actor.organization, pk=identifier).first()
    if record is None:
        raise Http404
    require_scope(actor, permission, record)


class InventoryTableFilter(BaseFilterBackend):
    def filter_queryset(
        self, request: Request, queryset: QuerySet[Any], view: APIView
    ) -> QuerySet[Any]:
        if getattr(view, "action", None) != "list":
            return queryset
        facets = getattr(view, "inventory_facets", {})
        values = validated_query(request, tuple(facets))
        actor = actor_from_request(request)
        for name, value in values.items():
            if name in RELATIONS:
                permission = getattr(view, "required_permissions", {}).get(
                    getattr(view, "action", ""), ""
                )
                require_relation(actor, (name, value), permission)
            if value in ("true", "false"):
                value = value == "true"
            queryset = queryset.filter(**{facets[name]: value})
        return queryset

    def get_schema_operation_parameters(self, view: APIView) -> list[dict[str, Any]]:
        if getattr(view, "action", None) != "list":
            return []
        fields = InventoryQuerySerializer().fields
        result = []
        for name in getattr(view, "inventory_facets", {}):
            field = fields[name]
            schema: dict[str, Any] = {"type": "string"}
            if isinstance(field, serializers.UUIDField):
                schema["format"] = "uuid"
            elif isinstance(field, serializers.DateTimeField):
                schema["format"] = "date-time"
            elif isinstance(field, serializers.ChoiceField):
                schema["enum"] = list(field.choices)
            result.append({"name": name, "required": False, "in": "query", "schema": schema})
        return result


def nested_parameters(names: tuple[str, ...]) -> list[OpenApiParameter]:
    fields = InventoryQuerySerializer().fields
    result = []
    for name in names:
        field = fields[name]
        kind = (
            OpenApiTypes.UUID
            if isinstance(field, serializers.UUIDField)
            else OpenApiTypes.DATETIME
            if isinstance(field, serializers.DateTimeField)
            else OpenApiTypes.DATE
            if isinstance(field, serializers.DateField)
            else OpenApiTypes.STR
        )
        result.append(
            OpenApiParameter(
                name,
                kind,
                enum=list(field.choices) if isinstance(field, serializers.ChoiceField) else None,
            )
        )
    return [*result, OpenApiParameter("ordering", OpenApiTypes.STR)]


def nested_order(request: Request, allowed: tuple[str, ...], default: str) -> list[str]:
    fields = [field.strip() for field in request.query_params.get("ordering", default).split(",")]
    if any(field.removeprefix("-") not in allowed for field in fields):
        raise serializers.ValidationError({"ordering": "Invalid ordering field."})
    return [*fields, "id"]
