"""Query-string filters shared by every org-scoped list endpoint."""

from typing import Any

from django.db.models import QuerySet
from rest_framework import serializers
from rest_framework.filters import BaseFilterBackend
from rest_framework.request import Request
from rest_framework.views import APIView

CODE_PARAM = "code"
CODE_MAX_LENGTH = 50


class CodeLookupFilter(BaseFilterBackend):
    """`?code=` on the list endpoint: exact match on the human code of the resource.

    A view opts in with `code_lookup_field = "<model field>"`; views that do not declare it are
    untouched. Only the `list` action is filtered. Surrounding whitespace is trimmed; a repeated
    parameter uses its last value; a blank, too long or NUL-containing value is
    `400 validation_error` with `fields.code`. Registered globally in `DEFAULT_FILTER_BACKENDS`
    (a viewset that sets its own `filter_backends` must include it to keep the lookup). The
    0-or-1 result guarantee needs `UniqueConstraint(organization, code)` on the model.
    """

    def filter_queryset(
        self, request: Request, queryset: QuerySet[Any], view: APIView
    ) -> QuerySet[Any]:
        lookup_field = getattr(view, "code_lookup_field", None)
        if lookup_field is None or getattr(view, "action", None) != "list":
            return queryset
        value = request.query_params.get(CODE_PARAM)
        if value is None:
            return queryset
        return queryset.filter(**{lookup_field: _validated_code(value)})

    def get_schema_operation_parameters(self, view: APIView) -> list[dict[str, Any]]:
        if getattr(view, "code_lookup_field", None) is None:
            return []
        return [
            {
                "name": CODE_PARAM,
                "required": False,
                "in": "query",
                "description": (
                    "Exact human code of the resource (for example `OV-010`); returns 0 or 1 "
                    "results. Blank values are rejected."
                ),
                "schema": {"type": "string", "maxLength": CODE_MAX_LENGTH},
            }
        ]


class CodeQuerySerializer(serializers.Serializer[Any]):
    """Validates `?code=`: not blank, at most `CODE_MAX_LENGTH`, no NUL characters (PostgreSQL
    rejects them, which would otherwise be a 500)."""

    code = serializers.CharField(max_length=CODE_MAX_LENGTH, trim_whitespace=True)


def _validated_code(value: str) -> str:
    query = CodeQuerySerializer(data={CODE_PARAM: value})
    query.is_valid(raise_exception=True)
    return str(query.validated_data[CODE_PARAM])
