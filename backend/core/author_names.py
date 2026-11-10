"""Read-only display names for the users that appear in API payloads (additive labels).

A payload that carries a user id (`created_by`, `voided_by`, `author`...) also carries
`<field>_name`: the personnel display name in the active organization, else the full name of the
user, else the username. The id stays in the payload; clients show the name and never the id.
"""

from collections.abc import Iterable
from typing import Any, cast
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.models import Personnel

AUTHOR_FIELDS = ("created_by", "voided_by", "author", "reviewer", "decided_by")
_CACHE_KEY = "_author_names"


def resolve_author_names(
    organization_id: UUID | str | None, user_ids: Iterable[object]
) -> dict[str, str]:
    """`{user_id: display name}` for every id that resolves; two queries at most."""
    ids = {str(user_id) for user_id in user_ids if user_id}
    names: dict[str, str] = {}
    if not ids:
        return names
    if organization_id:
        for user_id, display_name in Personnel.objects.filter(
            organization_id=organization_id, membership__user_id__in=ids
        ).values_list("membership__user_id", "display_name"):
            if display_name:
                names[str(user_id)] = display_name
    missing = ids - names.keys()
    if missing:
        user_model = get_user_model()
        for user_id, first, last, username in user_model.objects.filter(pk__in=missing).values_list(
            "pk", "first_name", "last_name", "username"
        ):
            names[str(user_id)] = f"{first} {last}".strip() or username
    return names


def _user_id_of(item: Any, field: str) -> str | None:
    if isinstance(item, dict):
        value = item.get(field, item.get(f"{field}_id"))
    else:
        value = getattr(item, f"{field}_id", None)
        if value is None:
            value = getattr(item, field, None)
    value = getattr(value, "pk", value)
    return str(value) if isinstance(value, str | UUID) else None


def _organization_id_of(
    serializer: serializers.Field[Any, Any, Any, Any], item: Any
) -> UUID | str | None:
    request = serializer.context.get("request")
    organization = getattr(request, "organization", None)
    if organization is not None:
        return getattr(organization, "pk", organization)
    if isinstance(item, dict):
        return item.get("organization_id")
    return getattr(item, "organization_id", None)


@extend_schema_field(OpenApiTypes.STR)
class AuthorNameField(serializers.Field[Any, Any, Any, Any]):
    """Display name of the user stored in `source_field` of the serialized item."""

    def __init__(self, source_field: str) -> None:
        super().__init__(read_only=True, source="*", allow_null=True)
        self.source_field = source_field

    def to_representation(self, value: Any) -> str | None:
        user_id = _user_id_of(value, self.source_field)
        if user_id is None:
            return None
        cache: dict[str, str] = cast(dict[str, Any], self.context).setdefault(_CACHE_KEY, {})
        if user_id not in cache:
            self._load(value, cache)
        return cache.get(user_id) or None

    def _load(self, item: Any, cache: dict[str, str]) -> None:
        """Resolve the ids of the whole list being serialized in one go (no N+1)."""
        items: list[Any] = [item]
        root = self.root
        if isinstance(root, serializers.ListSerializer) and isinstance(
            root.instance, list | tuple | QuerySet
        ):
            items = list(root.instance)
        ids = {
            _user_id_of(row, field)
            for row in items
            for field in {*AUTHOR_FIELDS, self.source_field}
        }
        wanted = {user_id for user_id in ids if user_id and user_id not in cache}
        wanted.add(_user_id_of(item, self.source_field) or "")
        wanted.discard("")
        wanted -= cache.keys()
        resolved = resolve_author_names(_organization_id_of(self, item), wanted)
        for user_id in wanted:
            # Ids that do not resolve stay blank: clients show "—", never the id.
            cache[user_id] = resolved.get(user_id, "")


class AuthorNamesMixin:
    """Adds a read-only `<field>_name` next to each user-id field the serializer exposes."""

    def get_fields(self) -> dict[str, serializers.Field[Any, Any, Any, Any]]:
        fields: dict[str, serializers.Field[Any, Any, Any, Any]] = super().get_fields()  # type: ignore[misc]
        for field in AUTHOR_FIELDS:
            if field in fields and f"{field}_name" not in fields:
                fields[f"{field}_name"] = AuthorNameField(field)
        return fields
