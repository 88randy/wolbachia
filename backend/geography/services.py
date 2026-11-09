"""Atomic geography writes: Organization NO KEY UPDATE -> Quadrant -> descendants.

Every writer takes the same organization serialization lock as configuration,
then re-reads authorization and the quadrant. No identity or published version
is overwritten. Expected revisions are compared only after serialization.
"""

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied

from core.exceptions import FieldValidationError
from field_sync.services import ChangeInput, FanoutScope, fanout_courier_changes
from geography.exceptions import (
    GeographyBusyError,
    StaleGeographyRevisionError,
    UnresolvedPointsError,
)
from geography.geometry import (
    contains_point,
    covers_polygon,
    distance_m,
    validate_location,
    validate_polygon,
)
from geography.models import (
    Block,
    BlockVersion,
    ExcludedPointResolution,
    PointVersion,
    Quadrant,
    QuadrantVersion,
    SamplingPoint,
)
from geography.permissions import QUADRANT_PUBLISH, SAMPLING_POINT_CREATE
from geography.selectors import (
    block_version_at,
    current_points,
    geography_reference_version,
    get_quadrant,
    quadrant_reference,
    quadrant_version_at,
    sampling_point_row,
)
from organizations.models import Center, Membership, Organization
from organizations.services import effective_scope
from rules.selectors import get_values_in_force

DEFAULT_MIN_DISTANCE_M = 50
MIN_SPACING_M = 10
MAX_SPACING_M = 200
MAX_EVIDENCE_LENGTH = 1000
DISTANCE_DECIMAL_PLACES = 6  # micrometre rounding stabilizes an exact threshold boundary


@dataclass(frozen=True)
class PointResolution:
    point: UUID
    decision: str
    evidence: str
    location: list[float] | None = None


@dataclass(frozen=True)
class QuadrantPublication:
    membership: Membership
    expected_revision: int
    geometry: dict[str, Any]
    point_resolutions: tuple[PointResolution, ...] = ()


@dataclass(frozen=True)
class QuadrantCreation:
    membership: Membership
    code: str
    geometry: dict[str, Any]


@dataclass(frozen=True)
class BlockCreation:
    membership: Membership
    code: str
    geometry: dict[str, Any]


@dataclass(frozen=True)
class BlockPublication:
    membership: Membership
    expected_revision: int
    geometry: dict[str, Any]


@dataclass(frozen=True)
class PointCreation:
    membership: Membership
    code: str
    location: list[float]


@dataclass(frozen=True)
class PointChange:
    membership: Membership
    expected_revision: int
    location: list[float]


def _geometry(value: object) -> dict[str, Any]:
    try:
        return validate_polygon(value)
    except ValueError as error:
        raise FieldValidationError(
            "geometry", "invalid_geometry", {"reason": str(error)}
        ) from error


def _location(value: object) -> list[float]:
    try:
        return validate_location(value)
    except ValueError as error:
        raise FieldValidationError("location", "invalid_location") from error


@contextmanager
def _organization_write(membership: Membership) -> Iterator[Membership]:
    try:
        with transaction.atomic():
            # Waiting publication writers see the committed revision and return 409.
            # A database lock timeout or deadlock still maps to retryable 429.
            Organization.objects.select_for_update(no_key=True).get(pk=membership.organization_id)
            current = (
                Membership.objects.select_related("user", "organization")
                .filter(pk=membership.pk, organization_id=membership.organization_id)
                .first()
            )
            if current is None:
                raise PermissionDenied
            yield current
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in {"55P03", "40P01"}:
            raise GeographyBusyError from error
        raise


@contextmanager
def _quadrant_write(
    quadrant: Quadrant, membership: Membership, permission: str
) -> Iterator[tuple[Quadrant, Membership, Callable[[ChangeInput], None]]]:
    with _organization_write(membership) as current:
        if not effective_scope(current).allows(permission):
            raise PermissionDenied
        scoped = get_quadrant(current, quadrant.pk, permission)
        scope = FanoutScope(current.organization, scoped.center_id, scoped.pk)
        with fanout_courier_changes(scope) as emit:
            locked = Quadrant.objects.select_for_update().get(pk=scoped.pk)
            yield locked, current, emit


def _check_revision(current: int, expected: int) -> None:
    if current != expected:
        raise StaleGeographyRevisionError


def _code(value: str) -> str:
    code = value.strip()
    if not code or len(code) > 50 or "\x00" in code:
        raise FieldValidationError("code", "invalid_code")
    return code


def create_quadrant(center: Center, change: QuadrantCreation) -> tuple[Quadrant, QuadrantVersion]:
    """Create and return the fixed identity and its exact initial geometry version."""
    geometry = _geometry(change.geometry)
    with _organization_write(change.membership) as member:
        grant = effective_scope(member)
        if not grant.allows(QUADRANT_PUBLISH):
            raise PermissionDenied
        scoped_center = Center.objects.filter(
            pk=center.pk, organization=member.organization, is_active=True
        ).first()
        quadrant = Quadrant(
            organization=member.organization,
            center=scoped_center,
            code=_code(change.code),
            created_by=member.user,
        )
        if scoped_center is None or not grant.allows(
            QUADRANT_PUBLISH, str(scoped_center.pk), str(quadrant.pk)
        ):
            raise NotFound
        if Quadrant.objects.filter(organization=member.organization, code=quadrant.code).exists():
            raise FieldValidationError("code", "duplicate_code")
        with fanout_courier_changes(
            FanoutScope(member.organization, quadrant.center_id, quadrant.pk)
        ) as emit:
            quadrant.save()
            version = QuadrantVersion.objects.create(
                organization=member.organization,
                quadrant=quadrant,
                revision=1,
                geometry=geometry,
                effective_from=timezone.now(),
                created_by=member.user,
            )
            emit_geography_reference(version, emit)
            return quadrant, version


def _validate_resolutions(
    quadrant: Quadrant, change: QuadrantPublication
) -> dict[UUID, PointVersion]:
    outside = {
        row.point_id: row
        for row in current_points(quadrant)
        if not row.is_retired and not contains_point(change.geometry, row.location)
    }
    decisions = {resolution.point: resolution for resolution in change.point_resolutions}
    for identifier in decisions:
        if not SamplingPoint.objects.filter(
            pk=identifier, organization_id=quadrant.organization_id, block__quadrant=quadrant
        ).exists():
            raise NotFound
    if len(decisions) != len(change.point_resolutions) or decisions.keys() - outside.keys():
        raise FieldValidationError("point_resolutions", "invalid_resolution_set")
    if missing := outside.keys() - decisions.keys():
        raise UnresolvedPointsError(sorted(str(identifier) for identifier in missing))
    for resolution in decisions.values():
        _validate_resolution(resolution, change.geometry)
    return outside


def _validate_resolution(resolution: PointResolution, geometry: dict[str, Any]) -> None:
    evidence = resolution.evidence.strip()
    if (
        not evidence
        or not any(character.isprintable() and not character.isspace() for character in evidence)
        or len(evidence) > MAX_EVIDENCE_LENGTH
    ):
        raise FieldValidationError("point_resolutions", "evidence_required")
    if resolution.decision not in {"keep", "move", "remove"}:
        raise FieldValidationError("point_resolutions", "invalid_decision")
    if resolution.decision == "move":
        if resolution.location is None or not contains_point(
            geometry, _location(resolution.location)
        ):
            raise FieldValidationError("point_resolutions", "move_outside_geometry")
    elif resolution.location is not None:
        raise FieldValidationError("point_resolutions", "unexpected_location")


def _append_resolution(
    version: QuadrantVersion, previous: PointVersion, resolution: PointResolution
) -> PointVersion:
    point_version = PointVersion.objects.create(
        organization_id=version.organization_id,
        point=previous.point,
        version=previous.version + 1,
        location=resolution.location if resolution.decision == "move" else previous.location,
        is_retired=resolution.decision == "remove",
        effective_from=version.effective_from,
        created_by=version.created_by,
    )
    ExcludedPointResolution.objects.create(
        organization_id=version.organization_id,
        quadrant_version=version,
        point=previous.point,
        point_version=point_version,
        decision=resolution.decision,
        evidence=resolution.evidence.strip(),
        created_by=version.created_by,
    )
    return point_version


def publish_quadrant(quadrant: Quadrant, change: QuadrantPublication) -> QuadrantVersion:
    """Append one revision only after exhaustive decisions; never mutate a prior row."""
    geometry = _geometry(change.geometry)
    with _quadrant_write(quadrant, change.membership, QUADRANT_PUBLISH) as (locked, member, emit):
        current = locked.versions.order_by("-revision").first()
        _check_revision(current.revision if current else 0, change.expected_revision)
        outside = _validate_resolutions(locked, change)
        version = QuadrantVersion.objects.create(
            organization=member.organization,
            quadrant=locked,
            revision=change.expected_revision + 1,
            geometry=geometry,
            effective_from=timezone.now(),
            created_by=member.user,
        )
        for resolution in change.point_resolutions:
            point_version = _append_resolution(version, outside[resolution.point], resolution)
            emit_point_projection(point_version, emit)
        emit_geography_reference(version, emit)
        version.spacing_warnings = _resolution_warnings(version)
        return version


def _resolution_warnings(version: QuadrantVersion) -> list[dict[str, Any]]:
    warnings = []
    for resolution in version.point_resolutions.select_related(
        "point__block__quadrant", "point_version"
    ):
        if resolution.decision != "remove":
            warnings.extend(
                spacing_warnings(
                    resolution.point.block, resolution.point_version.location, resolution.point_id
                )
            )
    return warnings


def _check_block_geometry(quadrant: Quadrant, geometry: dict[str, Any]) -> None:
    current = quadrant_version_at(quadrant, timezone.now())
    if current is None or not covers_polygon(current.geometry, geometry):
        raise FieldValidationError("geometry", "block_outside_quadrant")


def create_block(quadrant: Quadrant, change: BlockCreation) -> tuple[Block, BlockVersion]:
    """Create and return the block and its exact first published polygon."""
    geometry = _geometry(change.geometry)
    with _quadrant_write(quadrant, change.membership, QUADRANT_PUBLISH) as (locked, member, emit):
        _check_block_geometry(locked, geometry)
        code = _code(change.code)
        if Block.objects.filter(organization=member.organization, code=code).exists():
            raise FieldValidationError("code", "duplicate_code")
        block = Block.objects.create(
            organization=member.organization, quadrant=locked, code=code, created_by=member.user
        )
        version = BlockVersion.objects.create(
            organization=member.organization,
            block=block,
            geometry=geometry,
            revision=1,
            effective_from=timezone.now(),
            created_by=member.user,
        )
        emit_geography_reference(version, emit)
        return block, version


def publish_block(block: Block, change: BlockPublication) -> BlockVersion:
    """Append block geometry; active points outside it block publication."""
    geometry = _geometry(change.geometry)
    with _quadrant_write(block.quadrant, change.membership, QUADRANT_PUBLISH) as (
        quadrant,
        member,
        emit,
    ):
        block = Block.objects.get(pk=block.pk, organization=member.organization, quadrant=quadrant)
        current = block.versions.order_by("-revision").first()
        _check_revision(current.revision if current else 0, change.expected_revision)
        _check_block_geometry(quadrant, geometry)
        excluded = [
            str(row.point_id)
            for row in current_points(quadrant).filter(point__block=block, is_retired=False)
            if not contains_point(geometry, row.location)
        ]
        if excluded:
            raise UnresolvedPointsError(excluded)
        version = BlockVersion.objects.create(
            organization=member.organization,
            block=block,
            geometry=geometry,
            revision=change.expected_revision + 1,
            effective_from=timezone.now(),
            created_by=member.user,
        )
        emit_geography_reference(version, emit)
        return version


def _check_point_location(block: Block, location: list[float], at: datetime | None = None) -> None:
    instant = timezone.now() if at is None else at
    quadrant = quadrant_version_at(block.quadrant, instant)
    version = block_version_at(block, instant)
    if (
        quadrant is None
        or version is None
        or not contains_point(quadrant.geometry, location)
        or not contains_point(version.geometry, location)
    ):
        raise FieldValidationError("location", "point_outside_geometry")


def spacing_warnings(
    block: Block, location: list[float], excluded_point: UUID | None = None
) -> list[dict[str, Any]]:
    """Strictly below the current configured spacing warns, never rejects a write."""
    configured = get_values_in_force(block.organization, timezone.now()).get(
        "min_distance_same_block_m"
    )
    minimum = DEFAULT_MIN_DISTANCE_M if configured is None else configured
    if not MIN_SPACING_M <= minimum <= MAX_SPACING_M:
        raise FieldValidationError("min_distance_same_block_m", "out_of_range")
    warnings = []
    for row in (
        current_points(block.quadrant)
        .filter(point__block=block, is_retired=False)
        .exclude(point_id=excluded_point)
    ):
        distance = round(distance_m(location, row.location), DISTANCE_DECIMAL_PLACES)
        if distance < minimum:
            warnings.append(
                {
                    "code": "spacing_below_minimum",
                    "point": str(row.point_id),
                    "distance_m": distance,
                    "minimum_m": minimum,
                }
            )
    return warnings


def create_sampling_point(
    block: Block, change: PointCreation
) -> tuple[SamplingPoint, PointVersion, list[dict[str, Any]]]:
    """Reserve the fixed code; return identity, initial version and its spacing warnings."""
    location = _location(change.location)
    with _quadrant_write(block.quadrant, change.membership, SAMPLING_POINT_CREATE) as (
        _quadrant,
        member,
        emit,
    ):
        if block.organization_id != member.organization_id:
            raise NotFound
        _check_point_location(block, location)
        code = _code(change.code)
        if SamplingPoint.objects.filter(organization=member.organization, code=code).exists():
            raise FieldValidationError("code", "duplicate_code")
        warnings = spacing_warnings(block, location)
        point = SamplingPoint.objects.create(
            organization=member.organization, block=block, code=code, created_by=member.user
        )
        version = PointVersion.objects.create(
            organization=member.organization,
            point=point,
            location=location,
            version=1,
            effective_from=timezone.now(),
            created_by=member.user,
        )
        emit_point_projection(version, emit)
        return point, version, warnings


def publish_point(
    point: SamplingPoint, change: PointChange
) -> tuple[PointVersion, list[dict[str, Any]]]:
    """Relocate an active point with the same fixed code, optimistic version and history."""
    location = _location(change.location)
    with _quadrant_write(point.block.quadrant, change.membership, SAMPLING_POINT_CREATE) as (
        _quadrant,
        member,
        emit,
    ):
        if point.organization_id != member.organization_id:
            raise NotFound
        previous = point.versions.order_by("-version").first()
        _check_revision(previous.version if previous else 0, change.expected_revision)
        if previous is None or previous.is_retired:
            raise FieldValidationError("point", "point_retired")
        _check_point_location(point.block, location)
        warnings = spacing_warnings(point.block, location, point.pk)
        version = PointVersion.objects.create(
            organization=member.organization,
            point=point,
            location=location,
            version=change.expected_revision + 1,
            effective_from=timezone.now(),
            created_by=member.user,
        )
        emit_point_projection(version, emit)
        return version, warnings


def emit_geography_reference(
    version: QuadrantVersion | BlockVersion, emit: Callable[[ChangeInput], None]
) -> None:
    row = quadrant_reference(version)
    emit(
        ChangeInput(
            kind="quadrants",
            resource_type=row["resource_type"],
            resource_id=row["id"],
            resource_version=geography_reference_version(row),
            scope={"center_id": row["center_id"], "quadrant_id": row["quadrant_id"]},
            action="upsert",
            payload=row,
        )
    )


def emit_point_projection(version: PointVersion, emit: Callable[[ChangeInput], None]) -> None:
    from ovitraps.services import emit_point_ovitraps

    row = sampling_point_row(version)
    emit(
        ChangeInput(
            kind="sampling_points",
            resource_type="sampling_point",
            resource_id=row["id"],
            resource_version=str(version.version),
            scope={"center_id": row["center_id"], "quadrant_id": row["quadrant_id"]},
            action="upsert",
            payload=row,
        )
    )
    emit_point_ovitraps(version, emit)
