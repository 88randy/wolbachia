"""Opt-in DRF table filters; scoped querysets arrive before these run."""

from typing import Any

from django.db.models import QuerySet
from rest_framework import serializers
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.views import APIView


class TableSearchFilter(SearchFilter):
    """Keep list search out of object lookups and mutation actions."""

    def filter_queryset(
        self, request: Request, queryset: QuerySet[Any], view: APIView
    ) -> QuerySet[Any]:
        if getattr(view, "action", None) != "list":
            return queryset
        try:
            return super().filter_queryset(request, queryset, view)
        except serializers.ValidationError as error:
            raise serializers.ValidationError({self.search_param: error.detail}) from error

    def get_schema_operation_parameters(self, view: APIView) -> list[dict[str, Any]]:
        if getattr(view, "action", None) != "list":
            return []
        parameters = super().get_schema_operation_parameters(view)
        labels = getattr(view, "search_field_labels", {})
        fields = ", ".join(labels.get(field, field) for field in getattr(view, "search_fields", []))
        parameters[0]["description"] = f"Case-insensitive search across: {fields}."
        return parameters


class TableOrderingFilter(OrderingFilter):
    """Explicit public fields, stable ties and optional protected first ordering keys."""

    def get_ordering(self, request: Request, queryset: QuerySet[Any], view: APIView) -> list[str]:
        raw = request.query_params.get(self.ordering_param)
        fields = list(getattr(view, "ordering", []))
        if raw is not None:
            fields = [field.strip() for field in raw.split(",")]
            allowed = getattr(view, "ordering_fields", [])
            if any(field.removeprefix("-") not in allowed for field in fields):
                raise serializers.ValidationError({self.ordering_param: "Invalid ordering field."})
        aliases = getattr(view, "ordering_aliases", {})
        resolved = [
            ("-" if field.startswith("-") else "")
            + aliases.get(field.removeprefix("-"), field.removeprefix("-"))
            for field in fields
        ]
        return [*getattr(view, "ordering_prefix", []), *resolved, "id"]

    def filter_queryset(
        self, request: Request, queryset: QuerySet[Any], view: APIView
    ) -> QuerySet[Any]:
        if getattr(view, "action", None) != "list":
            return queryset
        return super().filter_queryset(request, queryset, view)

    def get_schema_operation_parameters(self, view: APIView) -> list[dict[str, Any]]:
        if getattr(view, "action", None) != "list":
            return []
        parameters = super().get_schema_operation_parameters(view)
        fields = ", ".join(getattr(view, "ordering_fields", []))
        parameters[0]["description"] = (
            f"Comma-separated fields: {fields}. Prefix with - for descending. "
            "Unsupported or blank terms return 400. Ties use id ascending."
        )
        return parameters
