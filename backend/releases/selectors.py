"""Scoped release reads and immutable current regulatory snapshots."""

from datetime import datetime
from typing import Any, cast

from django.db.models import Max, QuerySet

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
    reasons = []
    if PermitSuspension.objects.filter(permit=permit).exists():
        reasons.append("permit_suspended")
    version = current_permit_version(permit)
    if version is None:
        reasons.append("permit_unavailable")
    elif not version.valid_from <= server_now() < version.valid_to:
        reasons.append("permit_expired")
    return [{"reason": reason, "unblocked_by_role": "admin", "link": ""} for reason in reasons]


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
