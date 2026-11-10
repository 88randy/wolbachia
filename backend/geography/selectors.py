"""Scoped reads and temporal projections; no write or permission inferred from color."""

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from django.db.models import OuterRef, QuerySet, Subquery
from django.utils import timezone
from rest_framework.exceptions import NotFound

from core.exceptions import FieldValidationError
from core.snapshots import snapshot_hash
from field_sync.producers import ProducerContext, filter_producer_rows
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


REFERENCE_LOOKUPS = ("quadrant__center_id", "quadrant_id")
POINT_LOOKUPS = ("block__quadrant__center_id", "block__quadrant_id")


def quadrant_reference(version: QuadrantVersion | BlockVersion) -> dict[str, Any]:
    is_block = isinstance(version, BlockVersion)
    identity = version.block if isinstance(version, BlockVersion) else version.quadrant
    quadrant = identity.quadrant if isinstance(identity, Block) else identity
    row: dict[str, Any] = {
        "organization_id": str(version.organization_id),
        "resource_type": "block" if is_block else "quadrant",
        "id": str(identity.pk),
        "code": identity.code,
        "center_id": str(quadrant.center_id),
        "quadrant_id": str(quadrant.pk),
        "revision": version.revision,
    }
    if not is_block:
        from geography.decisions.models import QuadrantClosure

        closure = QuadrantClosure.objects.filter(
            organization_id=version.organization_id, quadrant_version_id=version.pk
        ).first()
        row.update(
            is_closed=closure is not None, closure_id=None if closure is None else str(closure.pk)
        )
    return row


def geography_reference_version(row: dict[str, Any]) -> str:
    if row["resource_type"] == "block":
        return str(row["revision"])
    return snapshot_hash({key: value for key, value in row.items() if key != "organization_id"})


def sampling_point_row(version: PointVersion) -> dict[str, Any]:
    point = version.point
    return {
        "organization_id": str(version.organization_id),
        "center_id": str(point.block.quadrant.center_id),
        "quadrant_id": str(point.block.quadrant_id),
        "id": str(point.pk),
        "code": point.code,
        "block_id": str(point.block_id),
        "location": version.location,
        "is_retired": version.is_retired,
        "version": version.version,
    }


def build_quadrant_references(ctx: ProducerContext) -> list[dict[str, Any]]:
    quadrants = filter_producer_rows(Quadrant.objects.all(), ctx, ("center_id", "pk"))
    latest_quadrant = (
        QuadrantVersion.objects.filter(quadrant=OuterRef("quadrant_id"))
        .order_by("-revision")
        .values("pk")[:1]
    )
    versions = (
        QuadrantVersion.objects.filter(
            organization=ctx.organization, quadrant__in=quadrants, pk=Subquery(latest_quadrant)
        )
        .select_related("quadrant")
        .order_by("quadrant_id")
    )
    blocks = filter_producer_rows(Block.objects.all(), ctx, REFERENCE_LOOKUPS)
    latest_block = (
        BlockVersion.objects.filter(block=OuterRef("block_id"))
        .order_by("-revision")
        .values("pk")[:1]
    )
    block_versions = (
        BlockVersion.objects.filter(
            organization=ctx.organization, block__in=blocks, pk=Subquery(latest_block)
        )
        .select_related("block__quadrant")
        .order_by("block_id")
    )
    return [quadrant_reference(version) for version in versions] + [
        quadrant_reference(version) for version in block_versions
    ]


def build_quadrant_zones(ctx: ProducerContext) -> list[dict[str, Any]]:
    """Polygons of the quadrants inside the scope of the caller (latest version), for the field map."""
    quadrants = filter_producer_rows(Quadrant.objects.all(), ctx, ("center_id", "pk"))
    latest = (
        QuadrantVersion.objects.filter(quadrant=OuterRef("quadrant_id"))
        .order_by("-revision")
        .values("pk")[:1]
    )
    versions = (
        QuadrantVersion.objects.filter(
            organization=ctx.organization, quadrant__in=quadrants, pk=Subquery(latest)
        )
        .select_related("quadrant")
        .order_by("quadrant__code")
    )
    return [
        {
            "id": str(version.quadrant_id),
            "code": version.quadrant.code,
            "ring": version.geometry["coordinates"][0],
        }
        for version in versions
    ]


def build_sampling_points(ctx: ProducerContext) -> list[dict[str, Any]]:
    points = filter_producer_rows(SamplingPoint.objects.all(), ctx, POINT_LOOKUPS)
    latest = (
        PointVersion.objects.filter(point=OuterRef("point_id"))
        .order_by("-version")
        .values("pk")[:1]
    )
    versions = (
        PointVersion.objects.filter(
            organization=ctx.organization, point__in=points, pk=Subquery(latest)
        )
        .select_related("point__block__quadrant")
        .order_by("point_id")
    )
    return [sampling_point_row(version) for version in versions]
