"""Query-string filters shared by every org-scoped list endpoint."""

from typing import Any

from django.db.models import QuerySet
from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.filters import BaseFilterBackend
from rest_framework.request import Request
from rest_framework.views import APIView

CODE_PARAM = "code"
CODE_MAX_LENGTH = 50


class CodeLookupFilter(BaseFilterBackend):
    """`?code=` on the list endpoint: exact match on the human code of the resource.

    A view opts in with `code_lookup_field = "<model field>"`; views that do not declare it are
    untouched. Only the `list` action is filtered. A repeated parameter uses its last value;
    a blank or longer-than-`CODE_MAX_LENGTH` value is `400 validation_error` with `fields.code`.
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


def _validated_code(value: str) -> str:
    code = value.strip()
    if not code:
        raise ValidationError({CODE_PARAM: [ErrorDetail("This field may not be blank.", "blank")]})
    if len(code) > CODE_MAX_LENGTH:
        raise ValidationError(
            {CODE_PARAM: [ErrorDetail("Ensure this value is short enough.", "max_length")]}
        )
    return code
