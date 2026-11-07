"""Atomic lifecycle writes; every review signal precedes domain and courier effects."""

from collections.abc import Callable, Iterator
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db import DatabaseError, IntegrityError, transaction
from rest_framework.exceptions import ValidationError
from rest_framework.serializers import UUIDField

from catalogs.models import CatalogSnapshot
from core.void_reason import validate_void_reason
from field_sync.codes import INVALID_PAYLOAD
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from field_sync.services import (
    RETRYABLE_SQLSTATES,
    ChangeInput,
    check_deferred_constraints_now,
    fanout_courier_changes,
    rejection_params,
    set_batch_lock_timeout,
)
from organizations.models import Membership, Organization
from ovitraps import codes
from ovitraps.capture import Capture, capture_context
from ovitraps.findings import CatalogChoice, resolve_item, validate_other_text
from ovitraps.lifecycle.exceptions import RemovalConflictError, RemovalInProgressError
from ovitraps.lifecycle.models import (
    OvitrapIncidentLink,
    PhysicalOvitrapLineage,
    RelocationDecision,
    RelocationProposal,
    RemovalAttempt,
    RemovalResolution,
)
from ovitraps.lifecycle.selectors import active_ovitraps, is_active, scoped_removal
from ovitraps.models import Ovitrap, OvitrapReading
from ovitraps.selectors import accessible_ovitrap, event_scoped, projected_ovitraps
from ovitraps.services import (
    _append_ovitrap_void,
    emit_ovitrap,
    lock_organization,
    point_fanout_scope,
)
from reviews.effect_receipts import is_effective

REASON_CATALOGS = {
    "replace": "replacement-reason",
    "relocate": "relocation-reason",
    "remove": "removal-reason",
}
INCIDENT_FINDINGS = frozenset({"abandoned", "removed"})


@dataclass(frozen=True)
class LifecycleCapture:
    ovitrap: Ovitrap
    capture: Capture
    reason: CatalogChoice


def _scoped_identity(ctx: EventContext, identifier: UUID) -> Ovitrap:

    visible = event_scoped(
        Ovitrap.objects.filter(organization=ctx.organization).select_related(
            "sampling_point__block__quadrant"
        ),
        ctx,
    )
    ovitrap = visible.filter(client_uuid=identifier).first()
    if ovitrap is None:
        raise EventRejected(codes.OVITRAP_INACCESSIBLE)
    return cast(Ovitrap, ovitrap)


def _resolve_reason(ctx: EventContext, payload: dict[str, Any], kind: str) -> CatalogChoice:
    snapshot = CatalogSnapshot.objects.filter(
        organization=ctx.organization, version=ctx.envelope.catalog_version
    ).first()
    if snapshot is None:
        raise EventNeedsReview(codes.CATALOG_VERSION_UNAVAILABLE)
    reason = resolve_item(snapshot, REASON_CATALOGS[kind], payload["reason_code"])
    validate_other_text(payload, (reason.historical,))
    if not reason.item.is_active:
        raise EventNeedsReview(codes.CATALOG_DEACTIVATED)
    return reason


def apply_lifecycle(ctx: EventContext, payload: dict[str, Any]) -> None:
    """Serialize organization, try-lock fan-out before point/old identity, then append once."""
    kind = ctx.envelope.type.removeprefix("ovitrap.")
    lock_organization(ctx)
    scoped = _scoped_identity(ctx, payload["ovitrap_id"])
    boundary = (
        nullcontext(None)
        if kind == "relocate"
        else fanout_courier_changes(point_fanout_scope(scoped.sampling_point))
    )
    with boundary as emit:
        if scoped.event.voided_at is not None:
            raise EventNeedsReview(codes.STALE_IDENTITY)
        ovitrap = accessible_ovitrap(ctx, payload["ovitrap_id"])
        if not is_active(ovitrap) or ctx.envelope.device_time < ovitrap.event.device_time:
            raise EventNeedsReview(codes.STALE_IDENTITY)
        if (
            kind == "replace"
            and Ovitrap.objects.filter(
                organization=ctx.organization, client_uuid=payload["replacement_id"]
            ).exists()
        ):
            raise EventNeedsReview(codes.STALE_IDENTITY)
        reason = _resolve_reason(ctx, payload, kind)
        capture = capture_context(ctx, ovitrap.sampling_point)
        if not payload["evidence_ids"]:
            raise EventNeedsReview(codes.EVIDENCE_REQUIRED)
        from uploads.gates import require_event_evidence

        require_event_evidence(ctx, payload["evidence_ids"])
        resolved = LifecycleCapture(ovitrap, capture, reason)
        _append_lifecycle(ctx, payload, resolved)
        if emit is not None:
            _emit_lifecycle(ctx, payload, emit)


def _record_fields(
    ctx: EventContext, payload: dict[str, Any], resolved: LifecycleCapture
) -> dict[str, Any]:
    return {
        "organization": ctx.organization,
        "created_by": ctx.user,
        "event_id": ctx.envelope.id,
        "point_version": resolved.capture.point_version,
        "reason": resolved.reason.item,
        "reason_code": resolved.reason.historical["code"],
        "reason_label": {
            "es-MX": resolved.reason.historical["label_es"],
            "en": resolved.reason.historical["label_en"],
        },
        "other_text": payload["other_text"],
        "evidence_ids": payload["evidence_ids"],
        "evaluated_rules": resolved.capture.rules,
        "rule_version_ids": resolved.capture.version_ids,
    }


def _append_lifecycle(
    ctx: EventContext, payload: dict[str, Any], resolved: LifecycleCapture
) -> None:
    fields = _record_fields(ctx, payload, resolved)
    ovitrap = resolved.ovitrap
    if ctx.envelope.type == "ovitrap.relocate":
        RelocationProposal.objects.create(
            **fields,
            ovitrap=ovitrap,
            old_location=resolved.capture.point_version.location,
            new_location=payload["proposed_location"],
        )
    elif ctx.envelope.type == "ovitrap.remove":
        marker = (
            incident_link(ctx, ovitrap)
            if not payload["is_recovered"]
            else OvitrapIncidentLink.objects.filter(
                organization=ctx.organization, ovitrap=ovitrap
            ).first()
        )
        RemovalAttempt.objects.create(
            **fields,
            ovitrap=ovitrap,
            is_recovered=payload["is_recovered"],
            recovery_state="recovered" if payload["is_recovered"] else "unrecovered",
            incident_link=marker,
        )
    else:
        _append_replacement(ctx, payload, resolved)


def _append_replacement(
    ctx: EventContext, payload: dict[str, Any], resolved: LifecycleCapture
) -> None:
    try:
        with transaction.atomic():
            replacement = Ovitrap.objects.create(
                organization=ctx.organization,
                created_by=ctx.user,
                event_id=ctx.envelope.id,
                client_uuid=payload["replacement_id"],
                sampling_point=resolved.ovitrap.sampling_point,
                point_version=resolved.capture.point_version,
            )
            PhysicalOvitrapLineage.objects.create(
                **_record_fields(ctx, payload, resolved),
                point=resolved.ovitrap.sampling_point,
                old_trap=resolved.ovitrap,
                new_trap=replacement,
            )
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", "")
            == "ovitrap_org_client_uuid"
        ):
            raise EventNeedsReview(codes.STALE_IDENTITY) from None
        raise


def _emit_lifecycle(
    ctx: EventContext, payload: dict[str, Any], emit: Callable[[ChangeInput], None]
) -> None:
    # The source event is inserted by ingest after this handler. Overlay only the new identity.
    identifiers = [payload["ovitrap_id"]]
    if ctx.envelope.type == "ovitrap.replace":
        identifiers.append(payload["replacement_id"])
    for identifier in identifiers:
        if identifier == payload["ovitrap_id"]:
            emit_ovitrap(projected_ovitraps(ctx.organization).get(client_uuid=identifier), emit)
        else:
            replacement = Ovitrap.objects.select_related(
                "sampling_point__block__quadrant", "point_version"
            ).get(organization=ctx.organization, client_uuid=identifier)
            replacement.event = FieldEvent(id=ctx.envelope.id, device_time=ctx.envelope.device_time)
            replacement.sampling_point_version = (
                replacement.sampling_point.versions.order_by("-version")
                .values_list("version", flat=True)
                .first()
            )
            emit_ovitrap(replacement, emit)


def incident_link(ctx: EventContext, ovitrap: Ovitrap) -> OvitrapIncidentLink:
    """Append once, with unique-index arbitration contained in a savepoint."""
    existing = OvitrapIncidentLink.objects.filter(
        organization=ctx.organization, ovitrap=ovitrap
    ).first()
    if existing is not None:
        return cast(OvitrapIncidentLink, existing)
    try:
        with transaction.atomic():
            return OvitrapIncidentLink.objects.create(
                organization=ctx.organization,
                created_by=ctx.user,
                event_id=ctx.envelope.id,
                ovitrap=ovitrap,
            )
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", "")
            == "ovitrap_incident_once"
        ):
            return OvitrapIncidentLink.objects.get(organization=ctx.organization, ovitrap=ovitrap)
        raise


def void_lifecycle_event(ctx: EventContext, target: FieldEvent) -> None:
    """Compensate by derived state only; dependency checks preserve every source/evidence row."""
    try:
        reason = validate_void_reason(target.void_reason, "reason")
    except ValidationError as error:
        raise EventRejected(INVALID_PAYLOAD, rejection_params(error)) from None
    lock_organization(ctx)
    scoped = _scoped_identity(ctx, UUIDField().run_validation(target.payload["ovitrap_id"]))
    # No operational projection exists for a reviewed source event.
    has_effect = any(
        model.objects.filter(organization=ctx.organization, event=target).exists()
        for model in (PhysicalOvitrapLineage, RelocationProposal, RemovalAttempt)
    )
    boundary = (
        fanout_courier_changes(point_fanout_scope(scoped.sampling_point))
        if has_effect and target.type != "ovitrap.relocate"
        else nullcontext(None)
    )
    with boundary as emit:
        accessible_ovitrap(ctx, scoped.client_uuid)
        _check_void_dependents(ctx, target, scoped)
        _append_ovitrap_void(ctx, target, reason)
        if emit is not None:
            for row in projected_ovitraps(ctx.organization).filter(
                sampling_point_id=scoped.sampling_point_id
            ):
                emit_ovitrap(row, emit)


def _check_void_dependents(ctx: EventContext, target: FieldEvent, ovitrap: Ovitrap) -> None:
    blockers: list[dict[str, str]] = []
    if target.type in {"ovitrap.remove", "ovitrap.replace"}:
        from geography.decisions.models import QuadrantClosure
        from geography.decisions.retirements import closure_dependency

        for closure in QuadrantClosure.objects.filter(
            organization=ctx.organization,
            quadrant_version__quadrant=ovitrap.sampling_point.block.quadrant,
        ).select_related("quadrant_version"):
            dependency = closure_dependency(
                closure.readiness_snapshot, target.pk, closure.quadrant_version.revision
            )
            if dependency is not False:
                blockers.append(
                    {
                        "resource": "quadrant_closure"
                        if dependency
                        else "quadrant_closure_proof_unavailable",
                        "id": str(closure.pk),
                    }
                )
    if target.type == "ovitrap.replace":
        lineage = PhysicalOvitrapLineage.objects.filter(
            organization=ctx.organization, event=target
        ).first()
        if lineage is not None:
            blockers.extend(trap_dependents(lineage.new_trap))
    elif target.type == "ovitrap.relocate":
        blockers.extend(
            {"resource": "relocation_decision", "id": str(identifier)}
            for identifier in RelocationDecision.objects.filter(
                organization=ctx.organization, proposal__event=target
            )
            .order_by("id")
            .values_list("pk", flat=True)
        )
    elif target.type == "ovitrap.remove":
        blockers.extend(
            {"resource": "removal_resolution", "id": str(identifier)}
            for identifier in RemovalResolution.objects.filter(
                organization=ctx.organization, removal__event=target
            ).values_list("pk", flat=True)
        )
        # Restoring this identity must not occupy a point already assigned to another trap.
        blockers.extend(
            {"resource": "ovitrap", "id": str(row.client_uuid)}
            for row in active_ovitraps(ctx.organization)
            .filter(sampling_point_id=ovitrap.sampling_point_id)
            .exclude(pk=ovitrap.pk)
            .order_by("id")
        )
    if blockers:
        raise EventRejected(codes.VOID_BLOCKED, {"blocked_by": blockers})


def trap_dependents(ovitrap: Ovitrap) -> list[dict[str, str]]:
    """Retain even voided dependents: B-33/OP16 must explicitly compensate them."""
    blockers: list[dict[str, str]] = []
    for resource, rows in (
        ("reading", OvitrapReading.objects.filter(ovitrap=ovitrap)),
        ("replacement", PhysicalOvitrapLineage.objects.filter(old_trap=ovitrap)),
        ("removal", RemovalAttempt.objects.filter(ovitrap=ovitrap)),
        ("relocation", RelocationProposal.objects.filter(ovitrap=ovitrap)),
    ):
        blockers.extend(
            {"resource": resource, "id": str(identifier)}
            for identifier in rows.filter(organization=ovitrap.organization)
            .order_by("id")
            .values_list("pk", flat=True)
        )
    return blockers


@dataclass(frozen=True)
class RemovalResolutionRequest:
    expected_state: str
    outcome: str
    reason: str


@contextmanager
def _resolution_lock(member: Membership, identifier: UUID) -> Iterator[RemovalAttempt]:
    # Generic void owns FieldEvent before Organization: share that order, never invert it.
    original = scoped_removal(member, identifier)
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            FieldEvent.objects.select_for_update(nowait=True, no_key=True).get(
                pk=original.event_id, organization_id=member.organization_id
            )
            Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=member.organization_id
            )
            yield scoped_removal(member, identifier)
            check_deferred_constraints_now()
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise RemovalInProgressError from error
        raise


def resolve_removal(
    member: Membership, identifier: UUID, request: RemovalResolutionRequest
) -> RemovalResolution:
    """Append a supervisor decision once, after fresh scope/state checks under shared locks."""
    with _resolution_lock(member, identifier) as removal:
        if (
            request.expected_state != "unrecovered"
            or removal.recovery_state != "unrecovered"
            or removal.event.voided_at is not None
            or not is_effective(removal.event)
            or RemovalResolution.objects.filter(removal=removal).exists()
        ):
            raise RemovalConflictError
        return _append_resolution(member, removal, request)


def _append_resolution(
    member: Membership, removal: RemovalAttempt, request: RemovalResolutionRequest
) -> RemovalResolution:
    return RemovalResolution.objects.create(
        organization_id=member.organization_id,
        created_by=member.user,
        removal=removal,
        outcome=request.outcome,
        reason=validate_void_reason(request.reason, "reason"),
    )
