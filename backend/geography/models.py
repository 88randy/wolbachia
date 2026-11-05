"""Immutable identities and append-only published geography."""

from typing import ClassVar
from uuid import UUID

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel


class Quadrant(ImmutableMixin, OrgScopedModel):
    code = models.CharField(max_length=50)
    center = models.ForeignKey(
        "organizations.Center", on_delete=models.PROTECT, related_name="quadrants"
    )
    scope_quadrant_lookup: ClassVar[str] = "pk"

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"], name="geography_quadrant_org_code"
            )
        ]

    @property
    def quadrant_id(self) -> UUID:
        return self.pk


class QuadrantVersion(ImmutableMixin, OrgScopedModel):
    # Response metadata is computed under the same lock; never persisted.
    spacing_warnings: list[dict[str, object]]

    quadrant = models.ForeignKey(Quadrant, on_delete=models.PROTECT, related_name="versions")
    geometry = models.JSONField()
    revision = models.PositiveIntegerField()
    effective_from = models.DateTimeField()

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["quadrant", "revision"], name="geography_quadrant_revision"
            )
        ]
        indexes = [models.Index(fields=["quadrant", "-effective_from"])]


class Block(ImmutableMixin, OrgScopedModel):
    quadrant = models.ForeignKey(Quadrant, on_delete=models.PROTECT, related_name="blocks")
    code = models.CharField(max_length=50)
    scope_center_lookup: ClassVar[str] = "quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "quadrant_id"

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"], name="geography_block_org_code"
            )
        ]

    @property
    def center_id(self) -> UUID:
        return self.quadrant.center_id


class BlockVersion(ImmutableMixin, OrgScopedModel):
    block = models.ForeignKey(Block, on_delete=models.PROTECT, related_name="versions")
    geometry = models.JSONField()
    revision = models.PositiveIntegerField()
    effective_from = models.DateTimeField()

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(fields=["block", "revision"], name="geography_block_revision")
        ]
        indexes = [models.Index(fields=["block", "-effective_from"])]


class SamplingPoint(ImmutableMixin, OrgScopedModel):
    block = models.ForeignKey(Block, on_delete=models.PROTECT, related_name="sampling_points")
    code = models.CharField(max_length=50)
    scope_center_lookup: ClassVar[str] = "block__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "block__quadrant_id"

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"], name="geography_point_org_code"
            )
        ]

    @property
    def center_id(self) -> UUID:
        return self.block.quadrant.center_id

    @property
    def quadrant_id(self) -> UUID:
        return self.block.quadrant_id


class PointVersion(ImmutableMixin, OrgScopedModel):
    point = models.ForeignKey(SamplingPoint, on_delete=models.PROTECT, related_name="versions")
    location = models.JSONField()
    version = models.PositiveIntegerField()
    effective_from = models.DateTimeField()
    is_retired = models.BooleanField(default=False)

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(fields=["point", "version"], name="geography_point_version")
        ]
        indexes = [models.Index(fields=["point", "-effective_from"])]


class ExcludedPointResolution(ImmutableMixin, OrgScopedModel):
    quadrant_version = models.ForeignKey(
        QuadrantVersion, on_delete=models.PROTECT, related_name="point_resolutions"
    )
    point = models.ForeignKey(SamplingPoint, on_delete=models.PROTECT, related_name="resolutions")
    point_version = models.ForeignKey(PointVersion, on_delete=models.PROTECT, related_name="+")
    decision = models.CharField(
        max_length=6, choices=[("keep", "keep"), ("move", "move"), ("remove", "remove")]
    )
    evidence = models.TextField()

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["quadrant_version", "point"], name="geography_resolution_point_once"
            )
        ]
