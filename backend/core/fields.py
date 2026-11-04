from typing import Any

from django.db.models import QuerySet
from rest_framework import serializers


class OrgScopedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField[Any]):
    """Foreign key field restricted to the active organization. Mandatory for org-scoped models.

    A plain `PrimaryKeyRelatedField` would accept the id of another organization's record and
    link the two organizations. Here an id from another organization fails exactly like an id
    that does not exist (`does_not_exist`), so it also leaks nothing. Without an active
    organization on the request the field accepts nothing.
    """

    def get_queryset(self) -> QuerySet[Any] | None:
        queryset = super().get_queryset()
        if queryset is None:
            return None
        organization = getattr(self.context.get("request"), "organization", None)
        if organization is None:
            return queryset.none()
        return queryset.filter(organization=organization)
