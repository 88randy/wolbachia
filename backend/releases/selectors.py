"""Scoped release reads and immutable current regulatory snapshots."""

from datetime import datetime
from typing import Any, cast

from django.db.models import Max, OuterRef, Prefetch, QuerySet, Subquery

from core.time import server_now
from organizations.selectors import filter_by_scope
from releases.models import (
    Permit,
    PermitSuspension,
    PermitVersion,
    Release,
    ReleaseDevice,
    ReleaseDeviceStatus,
)
from releases.permissions import PERMIT_MANAGE, RELEASE_READ
from uploads.access import UploadActor, current_scope


def current_permit_version(permit: Permit, at: datetime | None = None) -> PermitVersion | None:
    query = PermitVersion.objects.filter(organization=permit.organization, permit=permit)
    if at is not None:
        query = query.filter(created_at__lte=at, valid_from__lte=at)
    return cast(PermitVersion | None, query.order_by("-revision").first())


def permit_revision(permit: Permit) -> int:
    version = (
        PermitVersion.objects.filter(permit=permit).aggregate(value=Max("revision"))["value"] or 0
    )
    suspension = (
        PermitSuspension.objects.filter(permit=permit).aggregate(value=Max("revision"))["value"]
        or 0
    )
    return max(int(version), int(suspension))


def current_device_status(device: ReleaseDevice) -> str:
    status = (
        ReleaseDeviceStatus.objects.filter(organization=device.organization, device=device)
        .order_by("-revision")
        .values_list("status", flat=True)
        .first()
    )
    return str(status or device.status)


def device_status_at(device: ReleaseDevice, at: datetime) -> str:
    """Later publication or reactivation never supplies earlier equipment authority."""
    if device.created_at > at:
        return "unavailable"
    status = (
        ReleaseDeviceStatus.objects.filter(
            organization=device.organization, device=device, created_at__lte=at
        )
        .order_by("-revision")
        .values_list("status", flat=True)
        .first()
    )
    return str(status or device.status)


def device_revision(device: ReleaseDevice) -> int:
    revision = ReleaseDeviceStatus.objects.filter(
        organization=device.organization, device=device
    ).aggregate(value=Max("revision"))["value"]
    return int(revision or 1)


def permit_blockers(permit: Permit) -> list[dict[str, str]]:
    return blockers_of(
        PermitSuspension.objects.filter(permit=permit).exists(), current_permit_version(permit)
    )


def blockers_of(suspended: bool, version: PermitVersion | None) -> list[dict[str, str]]:
    reasons = []
    if suspended:
        reasons.append("permit_suspended")
    if version is None:
        reasons.append("permit_unavailable")
    elif not version.valid_from <= server_now() < version.valid_to:
        reasons.append("permit_expired")
    return [{"reason": reason, "unblocked_by_role": "admin", "link": ""} for reason in reasons]


CURRENT_VERSIONS_ATTR = "current_versions"
CURRENT_STATUSES_ATTR = "current_statuses"


def with_current_permit_version(permits: QuerySet[Permit]) -> QuerySet[Permit]:
    """List/detail reads: the latest version (with its type) and the suspension with its notices
    load for the whole page instead of once per permit."""
    latest = PermitVersion.objects.filter(permit=OuterRef("permit")).order_by("-revision")
    current = PermitVersion.objects.filter(pk=Subquery(latest.values("pk")[:1])).select_related(
        "type"
    )
    return permits.select_related("suspension").prefetch_related(
        Prefetch("versions", queryset=current, to_attr=CURRENT_VERSIONS_ATTR),
        "suspension__notices",
    )


def with_current_device_status(devices: QuerySet[ReleaseDevice]) -> QuerySet[ReleaseDevice]:
    """List/detail reads: the latest status row of every device, in one query for the page."""
    latest = ReleaseDeviceStatus.objects.filter(device=OuterRef("device")).order_by("-revision")
    current = ReleaseDeviceStatus.objects.filter(pk=Subquery(latest.values("pk")[:1]))
    return devices.prefetch_related(
        Prefetch("statuses", queryset=current, to_attr=CURRENT_STATUSES_ATTR)
    )


def scoped_permits(actor: UploadActor, permission: str = PERMIT_MANAGE) -> QuerySet[Permit]:
    return cast(
        QuerySet[Permit],
        filter_by_scope(
            Permit.objects.filter(organization=actor.organization).select_related(
                "center", "quadrant"
            ),
            current_scope(actor),
            permission,
        ),
    )


def scoped_devices(actor: UploadActor, permission: str = RELEASE_READ) -> QuerySet[ReleaseDevice]:
    return cast(
        QuerySet[ReleaseDevice],
        filter_by_scope(
            ReleaseDevice.objects.filter(organization=actor.organization).select_related(
                "source_lot_version", "center", "quadrant", "source_lot"
            ),
            current_scope(actor),
            permission,
        ),
    )


def scoped_releases(actor: UploadActor) -> QuerySet[Release]:
    return cast(
        QuerySet[Release],
        filter_by_scope(
            Release.objects.filter(organization=actor.organization).select_related(
                "permit_version__permit__quadrant", "lot", "release_device"
            ),
            current_scope(actor),
            RELEASE_READ,
        ),
    )


def filter_context(query: QuerySet[Any], values: dict[str, Any]) -> QuerySet[Any]:
    prefix = "permit_version__permit__" if query.model is Release else ""
    return query.filter(
        **{
            f"{prefix}{key}_id": value
            for key, value in values.items()
            if key in {"center", "quadrant"}
        }
    )
