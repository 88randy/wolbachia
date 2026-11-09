"""Immutable planning creates neither physical custody nor a release reservation."""

from typing import Any, cast
from uuid import UUID

from django.db.models import Sum
from django.http import Http404

from accounts.models import User
from core.snapshots import snapshot_hash
from core.time import server_now
from core.void_reason import resolve_void_reason
from inventory.allocations.commands import AssignmentWrite, SupplyOutcome
from inventory.allocations.models import (
    InventoryIntent,
    OriginReleaseLine,
    OriginReleaseProof,
    Reconciliation,
    ReleaseCancellation,
    ReleaseCancellationLine,
    SupplyAssignment,
    SupplyAssignmentCommandReceipt,
    SupplyAssignmentLine,
    SupplyAssignmentVersion,
    SupplyReceiptLine,
)
from inventory.allocations.permissions import ALLOCATE
from inventory.allocations.policy import validate_supply_note
from inventory.allocations.scope import (
    location_context,
    require_assignment,
    require_contexts,
    require_current_courier,
)
from inventory.allocations.transactions import SupplyParticipants, supply_transaction
from inventory.exceptions import InventoryConflictError
from inventory.models import Location, Lot, Piece, SupplyTypeVersion
from inventory.selectors import current_location, current_lot, lot_safety
from inventory.transfers.policy import json_facts, stock_quantity
from shifts.models import Shift
from uploads.access import UploadActor


def write_assignment(command: AssignmentWrite) -> SupplyOutcome:
    """Authorize before replay, then CAS the exact immutable plan under the one arbiter."""
    origin, courier = _subjects(command)
    participants = SupplyParticipants(users=(courier.pk,), couriers=(courier.pk,))
    with supply_transaction(command.actor, participants):
        origin, courier = _subjects(command)
        digest = snapshot_hash(
            json_facts(
                {
                    "mode": "create" if command.assignment_id is None else "revise",
                    "target_id": command.assignment_id,
                    "values": command.values,
                }
            )
        )
        old = (
            SupplyAssignmentCommandReceipt.objects.filter(
                organization=command.actor.organization, command_id=command.values["command_id"]
            )
            .select_related("version__assignment")
            .first()
        )
        if old is not None:
            _check_plan_replay(command, old, digest)
            return SupplyOutcome(201, old.response, True)
        assignment, previous = _assignment_target(command, origin, courier)
        version = SupplyAssignmentVersion.objects.create(
            organization=assignment.organization,
            created_by=command.actor.user,
            assignment=assignment,
            revision=1 if previous is None else previous.revision + 1,
            previous=previous,
            planning_proof={"kind": "manual", "actor_id": str(command.actor.user.pk)},
        )
        lines = [_plan_line(version, row) for row in command.values["lines"]]
        response = {"assignment": assignment_data(assignment, version, lines)}
        SupplyAssignmentCommandReceipt.objects.create(
            organization=assignment.organization,
            created_by=command.actor.user,
            version=version,
            command_id=command.values["command_id"],
            input_hash=digest,
            response=response,
        )
        from inventory.allocations.history import publish_fact

        publish_fact(version, version)
        return SupplyOutcome(201, response)


def _subjects(command: AssignmentWrite) -> tuple[Location, User]:
    actor, values = command.actor, command.values
    origin = (
        Location.objects.filter(organization=actor.organization, pk=values["origin_id"])
        .select_related("center", "quadrant")
        .first()
    )
    courier = User.objects.filter(
        pk=values["courier_id"],
        is_active=True,
        memberships__organization=actor.organization,
        memberships__is_active=True,
    ).first()
    if origin is None or courier is None:
        raise Http404
    require_contexts(actor, ALLOCATE, [location_context(origin)])
    require_current_courier(courier, actor.organization, [location_context(origin)])
    return origin, courier


def _assignment_target(
    command: AssignmentWrite, origin: Location, courier: User
) -> tuple[SupplyAssignment, SupplyAssignmentVersion | None]:
    actor, values = command.actor, command.values
    if command.assignment_id is not None:
        assignment = require_assignment(actor, command.assignment_id, ALLOCATE)
        previous = assignment.versions.first()
        if assignment.origin_id != origin.pk or assignment.courier_id != courier.pk:
            raise InventoryConflictError("supply_assignment_identity_conflict")
        if previous is None or values["expected_revision"] != previous.revision:
            raise InventoryConflictError(
                "supply_revision_conflict", previous.revision if previous else 0
            )
        if assignment.date != values["date"] or assignment.shift_id != values.get("shift_id"):
            raise InventoryConflictError("supply_assignment_identity_conflict")
        return assignment, previous
    shift = None
    if values.get("shift_id") is not None:
        shift = Shift.objects.filter(
            organization=actor.organization, pk=values["shift_id"], courier=courier
        ).first()
        if shift is None:
            raise Http404
    assignment = SupplyAssignment.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        courier=courier,
        origin=origin,
        date=values["date"],
        shift=shift,
    )
    Reconciliation.objects.create(
        organization=actor.organization, created_by=actor.user, assignment=assignment
    )
    return assignment, None


def _check_plan_replay(
    command: AssignmentWrite, old: SupplyAssignmentCommandReceipt, digest: str
) -> None:
    require_assignment(command.actor, old.version.assignment_id, ALLOCATE)
    if (
        old.input_hash != digest
        or old.created_by_id != command.actor.user.pk
        or (
            command.assignment_id is not None and old.version.assignment_id != command.assignment_id
        )
    ):
        raise InventoryConflictError("supply_command_conflict")


def _plan_line(version: SupplyAssignmentVersion, values: dict[str, Any]) -> SupplyAssignmentLine:
    organization = version.organization
    lot = Lot.objects.filter(organization=organization, pk=values["lot_id"]).first()
    unit = SupplyTypeVersion.objects.filter(
        organization=organization, pk=values["unit_version_id"]
    ).first()
    piece = (
        None
        if values.get("piece_id") is None
        else Piece.objects.filter(organization=organization, pk=values["piece_id"], lot=lot).first()
    )
    if lot is None or unit is None or lot.supply_id != unit.supply_type_id:
        raise Http404
    if values.get("piece_id") is not None and piece is None:
        raise Http404
    quantity = stock_quantity(values["quantity"])
    if (unit.identity_kind == "piece") != (piece is not None) or (piece and quantity != 1):
        raise InventoryConflictError("supply_identity_conflict")
    return SupplyAssignmentLine.objects.create(
        id=values["id"],
        organization=organization,
        created_by=version.created_by,
        version=version,
        lot=lot,
        piece=piece,
        unit_version=unit,
        quantity=quantity,
    )


def assignment_data(
    assignment: SupplyAssignment,
    version: SupplyAssignmentVersion,
    lines: list[SupplyAssignmentLine] | None = None,
) -> dict[str, Any]:
    rows = list(version.lines.order_by("pk")) if lines is None else lines
    data = json_facts(
        {
            "id": assignment.pk,
            "courier_id": assignment.courier_id,
            "origin_id": assignment.origin_id,
            "date": assignment.date,
            "shift_id": assignment.shift_id,
            "revision": version.revision,
            "version_id": version.pk,
            "planning_proof": version.planning_proof,
            "lines": [
                {
                    "id": row.pk,
                    "lot_id": row.lot_id,
                    "piece_id": row.piece_id,
                    "unit_version_id": row.unit_version_id,
                    "quantity": row.quantity,
                }
                for row in rows
            ],
        }
    )
    return cast(dict[str, Any], data)


def execute_release(
    actor: UploadActor, intent: InventoryIntent, execution_id: UUID
) -> tuple[SupplyOutcome, int]:
    """The parent transaction has already prepared/locked every authentic participant."""
    del execution_id  # Release facts refer to the authentic prepared intent itself.
    from inventory.allocations.evidence import intent_evidence

    if intent.assignment_id is None:
        raise Http404
    assignment = require_assignment(actor, intent.assignment_id, ALLOCATE)
    version = assignment.versions.first()
    if version is None or version.revision != intent.expected_revision:
        raise InventoryConflictError("supply_revision_conflict", version.revision if version else 0)
    intent_evidence(actor, intent)
    if intent.kind == "release_cancel":
        return _cancel_release(actor, intent, version)
    return _release_plan(actor, intent, version)


def _release_plan(
    actor: UploadActor, intent: InventoryIntent, version: SupplyAssignmentVersion
) -> tuple[SupplyOutcome, int]:
    from inventory.allocations.stock import spendable_balance

    origin = version.assignment.origin
    lines = list(version.lines.select_related("lot", "piece", "unit_version").order_by("pk"))
    observed = [_release_observation(line, origin) for line in lines]
    proof = {
        "at": server_now().isoformat(),
        "origin_id": str(origin.pk),
        "lines": observed,
        "evidence": intent.declared_evidence,
    }
    release = OriginReleaseProof.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        version=version,
        intent=intent,
        proof=proof,
        manifest_hash=snapshot_hash(proof),
    )
    for line, observation in zip(lines, observed, strict=True):
        released = line.releases.aggregate(total=Sum("quantity"))["total"] or 0
        cancelled = (
            ReleaseCancellationLine.objects.filter(release_line__line=line).aggregate(
                total=Sum("quantity")
            )["total"]
            or 0
        )
        remaining = line.quantity - released + cancelled
        if remaining <= 0:
            raise InventoryConflictError("supply_already_released")
        if spendable_balance(line, origin) < remaining:
            raise InventoryConflictError("supply_insufficient_stock")
        OriginReleaseLine.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            release=release,
            line=line,
            quantity=remaining,
            safety_proof=observation,
            transit_policy_id=observation["transit_policy_id"],
        )
    return SupplyOutcome(
        201,
        {
            "release": {
                "id": str(release.pk),
                "assignment_id": str(version.assignment_id),
                "revision": version.revision,
                "proof": proof,
            }
        },
    ), version.revision


def _release_observation(line: SupplyAssignmentLine, origin: Location) -> dict[str, Any]:
    from inventory.allocations.models import CourierTransitPolicyVersion

    if not origin.center.is_active:
        raise InventoryConflictError("supply_storage_unavailable")
    version = current_lot(line.lot)
    safety = lot_safety(version, location=origin)
    if safety.status != "available":
        raise InventoryConflictError(
            safety.blocked_by[0] if safety.blocked_by else "inventory_not_dispatchable"
        )
    policy = CourierTransitPolicyVersion.objects.filter(
        organization=line.organization, supply_version=line.unit_version
    ).first()
    return {
        "line_id": str(line.pk),
        "lot_version_id": str(version.pk),
        "location_version_id": str(current_location(origin).pk),
        "supply_version_id": str(line.unit_version_id),
        "protocol_id": None if version.protocol_id is None else str(version.protocol_id),
        "safety": safety.status,
        "at": server_now().isoformat(),
        "transit_policy_id": str(policy.pk) if policy and policy.is_active else None,
    }


def _cancel_release(
    actor: UploadActor, intent: InventoryIntent, version: SupplyAssignmentVersion
) -> tuple[SupplyOutcome, int]:
    from field_sync.models import FieldEvent

    release = intent.release
    if release is None or release.version.assignment_id != version.assignment_id:
        raise Http404
    if (
        FieldEvent.objects.filter(
            organization=actor.organization,
            type="supplies.receive",
            status="in_review",
            payload__release_id=str(release.pk),
            voided_at__isnull=True,
        )
        .exclude(review_item__decisions__is_terminal=True)
        .exists()
    ):
        raise InventoryConflictError("supply_pending_receipt")
    values = intent.canonical_input
    choice = resolve_void_reason(
        actor.organization.pk, validate_supply_note(values["reason"]), values["reason_code"]
    )
    cancellation = ReleaseCancellation.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        release=release,
        intent=intent,
        reason_code=choice.code,
        reason=choice.reason,
    )
    for line in release.lines.order_by("pk"):
        credited = (
            SupplyReceiptLine.objects.filter(
                release_line=line, receipt__event__void_audit__isnull=True
            ).aggregate(total=Sum("quantity"))["total"]
            or 0
        )
        cancelled = line.cancellations.aggregate(total=Sum("quantity"))["total"] or 0
        remaining = line.quantity - credited - cancelled
        if remaining > 0:
            ReleaseCancellationLine.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                cancellation=cancellation,
                release_line=line,
                quantity=remaining,
            )
    if not cancellation.lines.exists():
        raise InventoryConflictError("supply_no_reservation_remaining")
    return SupplyOutcome(
        201, {"cancellation": {"id": str(cancellation.pk), "release_id": str(release.pk)}}
    ), version.revision
