"""Abstract bases every business table inherits (decisions 1 and 3).

Typical use::

    class Ovitrap(VoidableMixin, OrgScopedModel):
        ...

`VoidableMixin` goes first so its manager (`.voided()` / `.not_voided()`) and its `Meta`
(the void check constraint) win; a subclass `Meta` must extend `VoidableMixin.Meta`.
"""

import uuid
from typing import Any, ClassVar, Self

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.exceptions import ImmutableRecordError, PhysicalDeleteForbiddenError

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


IMMUTABLE_MESSAGE = "Insert-only records are never modified; add a new record instead."


class ImmutableQuerySet(OrgScopedQuerySet):
    """Refuses every bulk path that could modify stored rows."""

    def update(self, **kwargs: Any) -> int:  # noqa: ANN401
        raise ImmutableRecordError(self.model.immutable_message)

    def bulk_update(self, objs: Any, fields: Any, batch_size: int | None = None) -> int:  # noqa: ANN401
        raise ImmutableRecordError(self.model.immutable_message)

    def bulk_create(self, objs: Any, *args: Any, **kwargs: Any) -> list[Any]:  # noqa: ANN401
        if kwargs.get("update_conflicts"):
            raise ImmutableRecordError(self.model.immutable_message)
        return super().bulk_create(objs, *args, **kwargs)


class ImmutableMixin(models.Model):
    """Insert-only rows: a stored row cannot be modified (and `OrgScopedModel` forbids delete).

    `mutable_fields` lists the only fields `save(update_fields=...)` may write on a stored row
    (e.g. the void fields); everything else raises `ImmutableRecordError`. New instances are
    always inserted (`force_insert`), never turned into an update. The manager and the base
    manager (used by related lookups and `save`) are `ImmutableQuerySet`s. A subclass `Meta`
    must extend this `Meta` to keep `base_manager_name`. A database trigger is the last line of
    defense against raw SQL (see the migration of each model that uses this mixin).
    """

    mutable_fields: ClassVar[frozenset[str]] = frozenset()
    immutable_message: ClassVar[str] = IMMUTABLE_MESSAGE

    objects = ImmutableQuerySet.as_manager()

    class Meta:
        abstract = True
        base_manager_name = "objects"

    def save(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        if self._state.adding:
            kwargs["force_insert"] = True
        elif not self._only_mutable_fields(kwargs.get("update_fields")):
            raise ImmutableRecordError(self.immutable_message)
        super().save(*args, **kwargs)

    def _only_mutable_fields(self, update_fields: Any) -> bool:  # noqa: ANN401
        return bool(update_fields) and set(update_fields) <= self.mutable_fields
