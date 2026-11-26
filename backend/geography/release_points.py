"""Planned release points: a fixed code inside a quadrant, append-only location versions."""

from dataclasses import dataclass

from django.utils import timezone
from rest_framework.exceptions import NotFound

from core.exceptions import FieldValidationError
from geography.geometry import contains_point
from geography.models import Quadrant, ReleasePoint, ReleasePointVersion
from geography.permissions import QUADRANT_PUBLISH
from geography.selectors import quadrant_version_at
from geography.services import _check_revision, _code, _location, _quadrant_write
from organizations.models import Membership


@dataclass(frozen=True)
class ReleasePointCreation:
    membership: Membership
    code: str
    location: list[float]


@dataclass(frozen=True)
class ReleasePointChange:
    membership: Membership
    expected_revision: int
    location: list[float]


def _check_inside(quadrant: Quadrant, location: list[float]) -> None:
    version = quadrant_version_at(quadrant, timezone.now())
    if version is None or not contains_point(version.geometry, location):
        raise FieldValidationError("location", "point_outside_geometry")


def create_release_point(
    quadrant: Quadrant, change: ReleasePointCreation
) -> tuple[ReleasePoint, ReleasePointVersion]:
    location = _location(change.location)
    with _quadrant_write(quadrant, change.membership, QUADRANT_PUBLISH) as (locked, member, _):
        if locked.organization_id != member.organization_id:
            raise NotFound
        _check_inside(locked, location)
        code = _code(change.code)
        if ReleasePoint.objects.filter(organization=member.organization, code=code).exists():
            raise FieldValidationError("code", "duplicate_code")
        point = ReleasePoint.objects.create(
            organization=member.organization, quadrant=locked, code=code, created_by=member.user
        )
        version = ReleasePointVersion.objects.create(
            organization=member.organization,
            point=point,
            location=location,
            version=1,
            effective_from=timezone.now(),
            created_by=member.user,
        )
        return point, version


def move_release_point(point: ReleasePoint, change: ReleasePointChange) -> ReleasePointVersion:
    location = _location(change.location)
    with _quadrant_write(point.quadrant, change.membership, QUADRANT_PUBLISH) as (
        locked,
        member,
        _,
    ):
        if point.organization_id != member.organization_id:
            raise NotFound
        previous = point.versions.order_by("-version").first()
        _check_revision(previous.version if previous else 0, change.expected_revision)
        _check_inside(locked, location)
        return ReleasePointVersion.objects.create(
            organization=member.organization,
            point=point,
            location=location,
            version=change.expected_revision + 1,
            effective_from=timezone.now(),
            created_by=member.user,
        )
