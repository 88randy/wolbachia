"""Abstract bases every business table inherits (decisions 1 and 3).

Typical use::

    class Ovitrap(VoidableMixin, OrgScopedModel):
        ...

`VoidableMixin` goes first so its manager (`.voided()` / `.not_voided()`) and its `Meta`
(the void check constraint) win; a subclass `Meta` must extend `VoidableMixin.Meta`.
"""

import uuid
from typing import Any, Self

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.exceptions import PhysicalDeleteForbiddenError

DELETE_FORBIDDEN_MESSAGE = "Business records are never deleted; void them with a reason instead."


class OrgScopedQuerySet(models.QuerySet[Any]):
    """Queryset that isolates rows by organization and refuses physical deletion."""

    def for_org(self, organization: models.Model) -> Self:
        return self.filter(organization=organization)

    def delete(self) -> tuple[int, dict[str, int]]:
        raise PhysicalDeleteForbiddenError(DELETE_FORBIDDEN_MESSAGE)


class VoidableQuerySet(OrgScopedQuerySet):
    def not_voided(self) -> Self:
        return self.filter(voided_at__isnull=True)

    def voided(self) -> Self:
        return self.filter(voided_at__isnull=False)


class OrgScopedModel(models.Model):
    """Row-level isolation: every business table carries `organization` (indexed, required).

    `created_by` is null only for seed data created by management commands.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )

    objects = OrgScopedQuerySet.as_manager()

    class Meta:
        abstract = True

    def delete(
        self, using: str | None = None, keep_parents: bool = False
    ) -> tuple[int, dict[str, int]]:
        raise PhysicalDeleteForbiddenError(DELETE_FORBIDDEN_MESSAGE)


class VoidableMixin(models.Model):
    """A record is voided (never deleted): all three void fields are set together or not at all."""

    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    void_reason = models.TextField(blank=True, default="")

    objects = VoidableQuerySet.as_manager()

    class Meta:
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(voided_at__isnull=True, voided_by__isnull=True, void_reason="")
                    | (Q(voided_at__isnull=False, voided_by__isnull=False) & ~Q(void_reason=""))
                ),
                name="%(app_label)s_%(class)s_void_fields_consistent",
            )
        ]
