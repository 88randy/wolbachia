"""Canonical permit snapshots and transactional, scoped suspension publication."""

from typing import Any

from core.snapshots import snapshot_hash
from field_sync.producers import BundleProducer, ProducerContext, filter_producer_rows, register
from field_sync.services import ChangeInput, FanoutScope, fanout_courier_changes
from releases.models import Permit
from releases.projection_serializers import PermitBundleSerializer
from releases.selectors import current_permit_version, permit_blockers, permit_revision


def permit_payload(permit: Permit) -> dict[str, Any]:
    version = current_permit_version(permit)
    body = {
        "id": str(permit.pk),
        "code": permit.code,
        "permit_version_id": None if version is None else str(version.pk),
        "permit_type_id": None if version is None else str(version.type_id),
        "revision": permit_revision(permit),
        "center_id": str(permit.center_id),
        "quadrant_id": str(permit.quadrant_id),
        "geometry": None if version is None else version.geometry,
        "valid_from": None if version is None else version.valid_from.isoformat(),
        "valid_to": None if version is None else version.valid_to.isoformat(),
        "requirements": {} if version is None else version.type.requirements,
        "blocked_by": [item["reason"] for item in permit_blockers(permit)],
        "capture": None,
    }
    return {**body, "version": snapshot_hash(body)}


def build_permits(ctx: ProducerContext) -> list[dict[str, Any]]:
    from releases.capture_projections import bound_release_capture

    prepared = bound_release_capture(ctx)
    captures = prepared.release_capture_payloads or {}
    return [
        {
            **permit_payload(permit),
            "capture": captures.get(str(permit.pk)),
            "organization_id": str(ctx.organization.pk),
        }
        for permit in filter_producer_rows(Permit.objects.all(), ctx, ("center_id", "quadrant_id"))
    ]


def publish_permit(permit: Permit) -> None:
    """Caller retains prepared identity/Organization/courier locks through commit."""
    payload = permit_payload(permit)
    scope = FanoutScope(permit.organization, permit.center_id, permit.quadrant_id)
    with fanout_courier_changes(scope) as publish:
        publish(
            ChangeInput(
                "permits",
                "permit",
                str(permit.pk),
                payload["version"],
                scope.metadata,
                "upsert",
                payload,
            )
        )
    _record_suspension_notices(permit)


def _record_suspension_notices(permit: Permit) -> None:
    from field_sync.selectors import captured_scope, membership_snapshots
    from releases.models import PermitSuspension, PermitSuspensionNotice

    suspension = PermitSuspension.objects.filter(
        organization=permit.organization, permit=permit
    ).first()
    if suspension is None:
        return
    for member in membership_snapshots(permit.organization):
        scope = captured_scope(member)
        permissions = ("field.bootstrap", "release.read", "permit.suspend")
        if any(
            scope.allows(code, str(permit.center_id), str(permit.quadrant_id))
            for code in permissions
        ):
            PermitSuspensionNotice.objects.get_or_create(
                organization=permit.organization,
                suspension=suspension,
                recipient=member,
                defaults={
                    "created_by": suspension.created_by,
                    "kind": "courier"
                    if scope.allows(
                        "field.bootstrap", str(permit.center_id), str(permit.quadrant_id)
                    )
                    else "coordinator",
                    "status": "delivery_unavailable",
                    "scope_snapshot": {
                        "center_id": str(permit.center_id),
                        "quadrant_id": str(permit.quadrant_id),
                    },
                },
            )


def register_permit_producer() -> None:
    register(BundleProducer("permits", 2, build_permits, PermitBundleSerializer))
