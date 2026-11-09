"""Fleet writes serialize on Motorcycle before examining allocation or blockers.

Account locks (User -> Device -> DeviceSession -> TokenPair) and courier locks, when
applicable, precede this domain lock. No external I/O runs in these transactions.
"""

from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID, uuid4

from django.http import Http404

from accounts.models import User
from core.exceptions import FieldValidationError
from core.services import void_validated_record
from core.void_reason import resolve_void_reason, validate_void_reason
from fleet.exceptions import FleetConflictError
from fleet.models import InspectionClearance, ResponsibilityLetter, ServiceRecord
from fleet.permissions import MOTORCYCLE_SERVICE_CLEAR
from fleet.selectors import active_blocks
from organizations.models import Membership
from shifts.access import authorize_motorcycle, lock_motorcycle
from shifts.models import BlockedReason, Motorcycle, MotorcycleBlockEvent
from shifts.permissions import MOTORCYCLE_MANAGE


@dataclass(frozen=True)
class ClearanceRequest:
    fault_id: UUID
    evidence_ids: list[UUID]
    reason: str
    expected_revision: int


def clear_fault(motorcycle: Motorcycle, reviewer: User, request: ClearanceRequest) -> Motorcycle:
    """Append a clearance of exactly one open severe fault, preserving every other blocker."""
    with lock_motorcycle(motorcycle) as locked:
        authorize_motorcycle(locked, reviewer, MOTORCYCLE_SERVICE_CLEAR)
        reason = validate_void_reason(request.reason, "reason")
        if not request.evidence_ids:
            raise FieldValidationError("evidence_ids", "empty")
        if locked.revision != request.expected_revision:
            raise FleetConflictError("motorcycle_revision_conflict")
        opened = active_blocks(locked)
        fault = next(
            (
                block
                for block in opened
                if block.pk == request.fault_id
                and block.blocked_reason == BlockedReason.SEVERE_CHECK
            ),
            None,
        )
        if fault is None:
            if not MotorcycleBlockEvent.objects.filter(
                pk=request.fault_id, motorcycle=locked, organization_id=locked.organization_id
            ).exists():
                raise Http404
            raise FleetConflictError("motorcycle_fault_not_open")
        from uploads.gates import require_fault_evidence

        require_fault_evidence(fault, request.evidence_ids)
        _insert_clearance(locked, reviewer, (request, reason, fault))
        _save_remaining_blocks(locked, [block for block in opened if block.pk != fault.pk])
        return locked


def _insert_clearance(
    motorcycle: Motorcycle,
    reviewer: User,
    decision: tuple[ClearanceRequest, str, MotorcycleBlockEvent],
) -> None:
    request, reason, fault = decision
    audit = MotorcycleBlockEvent.objects.create(
        organization_id=motorcycle.organization_id,
        created_by=reviewer,
        motorcycle=motorcycle,
        action="unblock",
        blocked_reason=BlockedReason.SEVERE_CHECK,
        reason=reason,
    )
    InspectionClearance.objects.create(
        organization_id=motorcycle.organization_id,
        created_by=reviewer,
        fault=fault,
        evidence_ids=[str(identifier) for identifier in request.evidence_ids],
        reviewer=reviewer,
        reason=reason,
        unblock_event=audit,
    )


def _save_remaining_blocks(motorcycle: Motorcycle, remaining: list[MotorcycleBlockEvent]) -> None:
    # Preserve an older scalar-only service/out-of-service blocker too.
    reason = remaining[-1].blocked_reason if remaining else ""
    if not reason and motorcycle.blocked_reason not in ("", BlockedReason.SEVERE_CHECK):
        reason = motorcycle.blocked_reason
    motorcycle.is_blocked = bool(reason)
    motorcycle.blocked_reason = reason
    motorcycle.revision += 1
    motorcycle.save(update_fields=["is_blocked", "blocked_reason", "revision"])


def require_inspection_for_severe(motorcycle: Motorcycle) -> None:
    if any(
        fault.blocked_reason == BlockedReason.SEVERE_CHECK for fault in active_blocks(motorcycle)
    ):
        raise FleetConflictError("motorcycle_inspection_required")


def append_service(motorcycle: Motorcycle, actor: User, values: dict[str, Any]) -> ServiceRecord:
    with lock_motorcycle(motorcycle) as locked:
        authorize_motorcycle(locked, actor, MOTORCYCLE_MANAGE)
        identifier = uuid4()
        provenance = {
            "source": "service_record",
            "source_id": str(identifier),
            "service_interval_km": values.get("service_interval_km"),
            "service_interval_days": values.get("service_interval_days"),
        }
        return ServiceRecord.objects.create(
            id=identifier,
            organization_id=locked.organization_id,
            motorcycle=locked,
            created_by=actor,
            due_metric_provenance=provenance,
            **values,
        )


def append_letter(
    motorcycle: Motorcycle, actor: User, values: dict[str, Any]
) -> ResponsibilityLetter:
    with lock_motorcycle(motorcycle) as locked:
        authorize_motorcycle(locked, actor, MOTORCYCLE_MANAGE)
        membership = Membership.objects.filter(
            user_id=values["courier"],
            organization_id=locked.organization_id,
            is_active=True,
            user__is_active=True,
        ).first()
        if membership is None:
            raise Http404
        return ResponsibilityLetter.objects.create(
            organization_id=locked.organization_id,
            motorcycle=locked,
            created_by=actor,
            courier=membership.user,
            **{key: value for key, value in values.items() if key != "courier"},
        )


def void_history(
    record: ServiceRecord | ResponsibilityLetter, actor: User, values: dict[str, Any]
) -> ServiceRecord | ResponsibilityLetter:
    # Catalog resolution stays before the domain lock, as in #80.
    choice = resolve_void_reason(record.organization_id, values["reason"], values["reason_code"])
    with lock_motorcycle(record.motorcycle) as motorcycle:
        authorize_motorcycle(motorcycle, actor, MOTORCYCLE_MANAGE)
        if isinstance(record, ServiceRecord):
            # Same Motorcycle -> ServiceRecord order as the source-bound safety
            # attestation. Never void the proof of a committed disposition (OP16).
            service = ServiceRecord.objects.select_for_update(nowait=True, no_key=True).get(
                pk=record.pk
            )
            from reviews.models import ReviewSafetyDisposition

            if ReviewSafetyDisposition.objects.filter(inspection=service).exists():
                raise FleetConflictError("service_has_safety_disposition")
            record = service
        return cast(
            ServiceRecord | ResponsibilityLetter, void_validated_record(record, actor, choice)
        )
