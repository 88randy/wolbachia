"""Atomic sync effects. Caller owns the sync savepoint and account/courier locks."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from core.void_reason import validate_void_reason
from field_sync.codes import INVALID_PAYLOAD
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.projection_serializers import OvitrapBundleSerializer
from field_sync.registry import EventContext
from field_sync.services import ChangeInput, FanoutScope, fanout_courier_changes, rejection_params
from geography.models import PointVersion, SamplingPoint
from organizations.models import Organization
from ovitraps import codes
from ovitraps.capture import Capture, capture_context, epi_week
from ovitraps.findings import CatalogChoice, validate_choices
from ovitraps.models import Bag, Ovitrap, OvitrapReading, OvitrapVoid, PlacementAttempt
from ovitraps.selectors import (
    accessible_ovitrap,
    accessible_point,
    latest_check_with_pending,
    ovitrap_row,
    projected_ovitraps,
)
from scheduling.courier_feed import emit_task_completion


@dataclass(frozen=True)
class ReadingCapture:
    ovitrap: Ovitrap
    capture: Capture
    finding: CatalogChoice
    paddle: CatalogChoice | None
    week: str


def lock_organization(ctx: EventContext) -> None:
    """Serialize scope changes and bag/reading allocation; never acquire account locks here."""
    Organization.objects.select_for_update(no_key=True).get(pk=ctx.organization.pk)


def place_ovitrap(ctx: EventContext, payload: dict[str, Any]) -> None:
    """Create identity and placement once; unverified supply/evidence refs have no stock effects."""
    lock_organization(ctx)
    point = accessible_point(ctx, payload["sampling_point_id"])
    if Ovitrap.objects.filter(
        organization=ctx.organization, client_uuid=payload["ovitrap_id"]
    ).exists():
        raise EventRejected(codes.IDENTITY_USED)
    capture = capture_context(ctx, point)
    from ovitraps.lifecycle.selectors import active_ovitraps

    if active_ovitraps(ctx.organization).filter(sampling_point=point).exists():
        raise EventRejected(codes.POINT_OCCUPIED)
    scope = point_fanout_scope(point)
    try:
        with transaction.atomic(), fanout_courier_changes(scope) as emit:
            ovitrap = Ovitrap.objects.create(
                client_uuid=payload["ovitrap_id"],
                organization=ctx.organization,
                created_by=ctx.user,
                event_id=ctx.envelope.id,
                sampling_point=point,
                point_version=capture.point_version,
            )
            PlacementAttempt.objects.create(
                organization=ctx.organization,
                created_by=ctx.user,
                event_id=ctx.envelope.id,
                ovitrap=ovitrap,
                supply_refs=[str(ref) for ref in payload["supply_refs"]],
                evidence_ids=[str(ref) for ref in payload["evidence_ids"]],
                evaluated_rules=capture.rules,
                rule_version_ids=capture.version_ids,
            )
            ovitrap.sampling_point_version = (
                point.versions.order_by("-version").values_list("version", flat=True).first()
            )
            ovitrap.event = FieldEvent(id=ctx.envelope.id, device_time=ctx.envelope.device_time)
            emit_ovitrap(ovitrap, emit)
            emit_task_completion(point, ctx.envelope, emit)
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", "")
            == "ovitrap_org_client_uuid"
        ):
            raise EventRejected(codes.IDENTITY_USED) from None
        raise


def check_ovitrap(ctx: EventContext, payload: dict[str, Any]) -> None:
    """Append a reading and its optional bag together; void a weekly reading before correcting it."""
    lock_organization(ctx)
    ovitrap = accessible_ovitrap(ctx, payload["ovitrap_id"])
    from ovitraps.lifecycle.selectors import is_active

    if not is_active(ovitrap):
        raise EventNeedsReview(codes.STALE_IDENTITY)
    if ctx.envelope.device_time < ovitrap.event.device_time:
        raise EventRejected(codes.OVITRAP_INACCESSIBLE)
    finding, paddle = validate_choices(ctx, payload)
    week = epi_week(ctx)
    if OvitrapReading.objects.filter(
        ovitrap=ovitrap, epi_week=week, event__voided_at__isnull=True
    ).exists():
        raise EventRejected(codes.READING_EXISTS)
    if (
        payload["bag_code"] is not None
        and Bag.objects.filter(organization=ctx.organization, code=payload["bag_code"]).exists()
    ):
        raise EventRejected(codes.BAG_CODE_USED)
    capture = capture_context(ctx, ovitrap.sampling_point)
    with fanout_courier_changes(point_fanout_scope(ovitrap.sampling_point)) as emit:
        if any(
            choice is not None and choice.historical.get("requires_photo")
            for choice in (finding, paddle)
        ):
            from uploads.gates import require_event_evidence

            require_event_evidence(ctx, payload["evidence_ids"])
        reading = _create_reading(
            ctx, payload, ReadingCapture(ovitrap, capture, finding, paddle, week)
        )
        from ovitraps.lifecycle.services import INCIDENT_FINDINGS, incident_link

        if finding.historical["code"] in INCIDENT_FINDINGS:
            incident_link(ctx, ovitrap)
        if payload["bag_code"] is not None:
            _create_bag(ctx, reading, payload["bag_code"])
        projected = projected_ovitraps(ctx.organization).get(pk=ovitrap.pk)
        projected.latest_check = latest_check_with_pending(projected, reading, ctx.envelope)
        emit_ovitrap(projected, emit)
        emit_task_completion(ovitrap.sampling_point, ctx.envelope, emit)


def _create_reading(
    ctx: EventContext, payload: dict[str, Any], resolved: ReadingCapture
) -> OvitrapReading:
    ovitrap, capture, finding, paddle, week = (
        resolved.ovitrap,
        resolved.capture,
        resolved.finding,
        resolved.paddle,
        resolved.week,
    )
    return OvitrapReading.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event_id=ctx.envelope.id,
        ovitrap=ovitrap,
        point_version=capture.point_version,
        finding=finding.item,
        finding_code=finding.historical["code"],
        finding_label={
            "es-MX": finding.historical["label_es"],
            "en": finding.historical["label_en"],
        },
        paddle_type=None if paddle is None else paddle.item,
        other_text=payload["other_text"],
        paddle_present=payload["paddle_present"],
        has_eggs=payload["has_eggs"],
        temperature_c=payload["temperature_c"],
        humidity_pct=payload["humidity_pct"],
        is_lagged=payload["is_lagged"],
        is_index_excluded=payload["is_lagged"],
        index_exclusion_reason="lagged" if payload["is_lagged"] else "",
        epi_week=week,
        evaluated_rules=capture.rules,
        rule_version_ids=capture.version_ids,
    )


def _create_bag(ctx: EventContext, reading: OvitrapReading, code: str) -> None:
    try:
        with transaction.atomic():
            Bag.objects.create(
                organization=ctx.organization,
                created_by=ctx.user,
                event_id=ctx.envelope.id,
                code=code,
                reading=reading,
                collector=ctx.user,
                field_flags={
                    "has_eggs": reading.has_eggs,
                    "is_lagged": reading.is_lagged,
                    "is_index_excluded": reading.is_index_excluded,
                },
            )
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", "")
            == "ovitrap_bag_org_code"
        ):
            raise EventRejected(codes.BAG_CODE_USED) from None
        raise


def void_ovitrap_event(ctx: EventContext, target: FieldEvent) -> None:
    """Append lifecycle correction; same-reading bags share its void, placement retains dependents."""
    try:
        reason = validate_void_reason(target.void_reason, "reason")
    except ValidationError as error:
        raise EventRejected(INVALID_PAYLOAD, rejection_params(error)) from None
    lock_organization(ctx)
    if target.type == "ovitrap.place":
        accessible_point(ctx, UUID(target.payload["sampling_point_id"]))
    else:
        accessible_ovitrap(ctx, UUID(target.payload["ovitrap_id"]))
    if target.type == "ovitrap.place":
        ovitrap = Ovitrap.objects.filter(organization=ctx.organization, event=target).first()
        if ovitrap is not None:
            from ovitraps.lifecycle.services import trap_dependents

            if blockers := trap_dependents(ovitrap):
                raise EventRejected(codes.VOID_BLOCKED, {"blocked_by": blockers})
    ovitrap = _void_target_ovitrap(ctx, target)
    if ovitrap is None:
        _append_ovitrap_void(ctx, target, reason)
        return
    with fanout_courier_changes(point_fanout_scope(ovitrap.sampling_point)) as emit:
        _append_ovitrap_void(ctx, target, reason)
        emit_ovitrap(projected_ovitraps(ctx.organization).get(pk=ovitrap.pk), emit)
        emit_task_completion(ovitrap.sampling_point, target, emit)


def _void_target_ovitrap(ctx: EventContext, target: FieldEvent) -> Ovitrap | None:
    """Reviewed events may have no operational row; retain their existing correction history."""
    if target.type == "ovitrap.place":
        return Ovitrap.objects.filter(organization=ctx.organization, event=target).first()
    reading = (
        OvitrapReading.objects.select_related("ovitrap")
        .filter(organization=ctx.organization, event=target)
        .first()
    )
    return None if reading is None else reading.ovitrap


def _append_ovitrap_void(ctx: EventContext, target: FieldEvent, reason: str) -> None:
    OvitrapVoid.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event_id=ctx.envelope.id,
        target_event=target,
        reason=reason,
        reason_code=target.void_reason_code,
    )


def point_fanout_scope(point: SamplingPoint) -> FanoutScope:
    return FanoutScope(point.organization, point.block.quadrant.center_id, point.block.quadrant_id)


def emit_ovitrap(ovitrap: Ovitrap, emit: Callable[[ChangeInput], None]) -> None:
    raw = ovitrap_row(ovitrap)
    serializer = OvitrapBundleSerializer(data=raw)
    serializer.is_valid(raise_exception=True)
    payload = dict(serializer.data)
    emit(
        ChangeInput(
            kind="ovitraps",
            resource_type="ovitrap",
            resource_id=str(ovitrap.client_uuid),
            resource_version=payload["version"],
            scope={"center_id": raw["center_id"], "quadrant_id": raw["quadrant_id"]},
            action="upsert",
            payload=payload,
        )
    )


def emit_point_ovitraps(version: PointVersion, emit: Callable[[ChangeInput], None]) -> None:
    """A point revision changes location/retirement; preserve immutable placement provenance."""
    for ovitrap in projected_ovitraps(version.organization).filter(
        sampling_point_id=version.point_id
    ):
        emit_ovitrap(ovitrap, emit)
