"""Scoped reads and temporal projections; no write or permission inferred from color."""

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from django.db.models import OuterRef, QuerySet, Subquery
from django.utils import timezone
from rest_framework.exceptions import NotFound

from core.exceptions import FieldValidationError
from geography.geometry import available_block_geometries, suggest_points
from geography.models import (
    Block,
    BlockVersion,
    PointVersion,
    Quadrant,
    QuadrantVersion,
    SamplingPoint,
)
from organizations.models import Membership
from organizations.selectors import filter_by_effective_scope


def visible_quadrants(membership: Membership, permission: str) -> QuerySet[Quadrant]:
    return cast(
        "QuerySet[Quadrant]",
        filter_by_effective_scope(
            Quadrant.objects.filter(organization=membership.organization).select_related("center"),
            membership,
            permission,
        ),
    )


def get_quadrant(membership: Membership, identifier: UUID | str, permission: str) -> Quadrant:
    quadrant = visible_quadrants(membership, permission).filter(pk=identifier).first()
    if quadrant is None:
        raise NotFound
    return quadrant


def quadrant_version_at(quadrant: Quadrant, captured_at: datetime) -> QuadrantVersion | None:
    """Inclusive effective instant, deterministic revision tie-break; visits keep this geometry."""
    return (
        QuadrantVersion.objects.filter(
            organization_id=quadrant.organization_id,
            quadrant=quadrant,
            effective_from__lte=captured_at,
        )
        .order_by("-effective_from", "-revision")
        .first()
    )


def block_version_at(block: Block, captured_at: datetime) -> BlockVersion | None:
    return (
        BlockVersion.objects.filter(
            organization_id=block.organization_id, block=block, effective_from__lte=captured_at
        )
        .order_by("-effective_from", "-revision")
        .first()
    )


def point_version_at(point: SamplingPoint, captured_at: datetime) -> PointVersion | None:
    return (
        PointVersion.objects.filter(
            organization_id=point.organization_id, point=point, effective_from__lte=captured_at
        )
        .order_by("-effective_from", "-version")
        .first()
    )


def current_points(quadrant: Quadrant) -> QuerySet[PointVersion]:
    """Latest revision of each identity, including retired points for historical access."""
    latest = (
        PointVersion.objects.filter(point=OuterRef("point_id"))
        .order_by("-version")
        .values("pk")[:1]
    )
    return PointVersion.objects.filter(
        organization_id=quadrant.organization_id,
        point__block__quadrant=quadrant,
        pk=Subquery(latest),
    ).select_related("point__block__quadrant")


def block_suggestion(quadrant: Quadrant) -> list[dict[str, Any]]:
    """Unoccupied Polygon pieces, each with four review points; no writes."""
    instant = timezone.now()
    version = quadrant_version_at(quadrant, instant)
    if version is None:
        return []
    occupied = [
        current.geometry
        for block in quadrant.blocks.all()
        if (current := block_version_at(block, instant)) is not None
    ]
    try:
        return [
            {
                "quadrant": str(quadrant.pk),
                "geometry": geometry,
                "points": suggest_points(geometry),
                "requires_review": True,
            }
            for geometry in available_block_geometries(version.geometry, occupied)
        ]
    except ValueError as error:
        raise FieldValidationError("quadrant", "suggestion_unavailable") from error
