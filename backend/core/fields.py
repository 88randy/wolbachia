from typing import Any

from django.core.exceptions import FieldDoesNotExist, ImproperlyConfigured
from django.db.models import Model, QuerySet
from rest_framework import serializers


class OrgScopedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField[Any]):
    """Foreign key field restricted to the active organization.

    A plain `PrimaryKeyRelatedField` would accept the id of another organization's record and
    link the two organizations. Here an id from another organization fails exactly like an id
    that does not exist (`does_not_exist`), so it also leaks nothing. Without an active
    organization on the request the field accepts nothing.

    Only for models that have an `organization` field (`OrgScopedModel`). Pointing it at any
    other model (users, organizations...) raises `ImproperlyConfigured` when the serializer is
    built, not a `FieldError` on the first request. Expose those relations read-only instead.
    `core.serializers.OrgScopedModelSerializer` uses this field for every relation.
    """

    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401
        super().__init__(**kwargs)
        model = getattr(getattr(self, "queryset", None), "model", None)
        if model is not None and not self._has_organization(model):
            raise ImproperlyConfigured(
                f"{type(self).__name__} needs a queryset of an org-scoped model, "
                f"but {model.__name__} has no `organization` field. "
                "Make the field read-only or use a plain related field on purpose."
            )

    @staticmethod
    def _has_organization(model: type[Model]) -> bool:
        try:
            model._meta.get_field("organization")
        except FieldDoesNotExist:
            return False
        return True

    def get_queryset(self) -> QuerySet[Any] | None:
        queryset = super().get_queryset()
        if queryset is None:
            return None
        organization = getattr(self.context.get("request"), "organization", None)
        if organization is None:
            return queryset.none()
        return queryset.filter(organization=organization)
