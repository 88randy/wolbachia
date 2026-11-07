"""The reserved supplies section now projects the courier's actual current custody."""

from typing import Any, cast

from django.db.models import Q

from field_sync.producers import BundleProducer, ProducerContext, register
from inventory.allocations.models import (
    OriginReleaseProof,
    SupplyAssignment,
    SupplyAssignmentVersion,
    SupplyEvent,
)
from inventory.allocations.permissions import RECEIVE_OWN, RECONCILE_OWN
from inventory.allocations.scope import scoped_assignments
from inventory.allocations.selectors import (
    assignment_projection,
    prepared_projection,
    projection_assignments,
    reconciliation_projection,
)
from uploads.access import UploadActor


def supply_projection(assignment: SupplyAssignment) -> dict[str, Any]:
    assignment = prepared_projection(assignment)
    base = assignment_projection(assignment)
    releases = []
    versions = cast(list[SupplyAssignmentVersion], assignment._supply_plan_versions)  # type: ignore[attr-defined]
    for release in reversed(versions):
        proofs = cast(list[OriginReleaseProof], release._supply_release_proofs)  # type: ignore[attr-defined]
        for proof in proofs:
            releases.append(
                {
                    "id": str(proof.pk),
                    "plan_revision": release.revision,
                    "manifest_hash": proof.manifest_hash,
                    "lines": [
                        {
                            "id": str(line.pk),
                            "assignment_line_id": str(line.line_id),
                            "quantity": str(line.quantity),
                            "transit_policy_id": None
                            if line.transit_policy_id is None
                            else str(line.transit_policy_id),
                        }
                        for line in proof.lines.all()
                    ],
                }
            )
    receipts = []
    events = cast(list[SupplyEvent], assignment._supply_receipt_events)  # type: ignore[attr-defined]
    for event in events:
        receipt = event.receipt
        receipts.append(
            {
                "id": str(receipt.pk),
                "event_id": str(event.pk),
                "source_event_id": str(event.source_link.source_event_id),
                "release_id": str(receipt.release_id),
                "signature_upload_id": str(receipt.signature.public_id),
                "voided": hasattr(event, "void_audit"),
                "lines": [
                    {
                        "id": str(line.pk),
                        "release_line_id": str(line.release_line_id),
                        "quantity": str(line.quantity),
                    }
                    for line in receipt.lines.all()
                ],
            }
        )
    return {
        **base,
        "organization_id": str(assignment.organization_id),
        "center_id": str(assignment.origin.center_id),
        "quadrant_id": None
        if assignment.origin.quadrant_id is None
        else str(assignment.origin.quadrant_id),
        "reconciliation": reconciliation_projection(assignment.reconciliation),
        "releases": releases,
        "receipts": receipts,
    }


def build_supplies(ctx: ProducerContext) -> list[dict[str, Any]]:
    return [supply_projection(row) for row in current_supply_assignments(ctx)]


def current_supply_assignments(ctx: ProducerContext) -> Any:  # noqa: ANN401 -- concrete scoped QuerySet[SupplyAssignment]
    actor = UploadActor(ctx.user, ctx.organization)
    allowed = Q(pk__in=scoped_assignments(actor, RECEIVE_OWN, ctx.scope).values("pk")) | Q(
        pk__in=scoped_assignments(actor, RECONCILE_OWN, ctx.scope).values("pk")
    )
    return projection_assignments(
        SupplyAssignment.objects.filter(organization=ctx.organization, courier=ctx.user)
        .filter(allowed, pk__in=scoped_assignments(actor, ctx.permission, ctx.scope).values("pk"))
        .select_related("origin")
        .order_by("date", "pk")
    )


def register_supply_producer() -> None:
    from inventory.allocations.serializers import SupplyBundleSerializer

    register(BundleProducer("supplies", 1, build_supplies, SupplyBundleSerializer))
