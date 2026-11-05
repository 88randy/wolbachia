"""Atomic sync effects. Caller owns the sync savepoint and account/courier locks."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from core.void_reason import validate_void_reason
from field_sync.codes import INVALID_PAYLOAD
from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from field_sync.services import rejection_params
from organizations.models import Organization
from ovitraps import codes
from ovitraps.capture import Capture, capture_context, epi_week
from ovitraps.findings import CatalogChoice, validate_choices
from ovitraps.models import Bag, Ovitrap, OvitrapReading, OvitrapVoid, PlacementAttempt
from ovitraps.selectors import accessible_ovitrap, accessible_point


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
    if Ovitrap.objects.filter(pk=payload["ovitrap_id"]).exists():
        raise EventRejected(codes.IDENTITY_USED)
    if Ovitrap.objects.filter(sampling_point=point, event__voided_at__isnull=True).exists():
        raise EventRejected(codes.POINT_OCCUPIED)
    capture = capture_context(ctx, point)
    try:
        with transaction.atomic():
            ovitrap = Ovitrap.objects.create(
                id=payload["ovitrap_id"],
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
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", "")
            == "ovitraps_ovitrap_pkey"
        ):
            raise EventRejected(codes.IDENTITY_USED) from None
        raise


def check_ovitrap(ctx: EventContext, payload: dict[str, Any]) -> None:
    """Append a reading and its optional bag together; void a weekly reading before correcting it."""
    lock_organization(ctx)
    ovitrap = accessible_ovitrap(ctx, payload["ovitrap_id"])
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
    reading = _create_reading(ctx, payload, ReadingCapture(ovitrap, capture, finding, paddle, week))
    if payload["bag_code"] is not None:
        _create_bag(ctx, reading, payload["bag_code"])


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
            blockers = OvitrapReading.objects.filter(ovitrap=ovitrap).order_by("id")
            if blockers.exists():
                raise EventRejected(
                    codes.VOID_BLOCKED,
                    {
                        "blocked_by": [
                            {"resource": "reading", "id": str(row.pk)} for row in blockers
                        ]
                    },
                )
    OvitrapVoid.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event_id=ctx.envelope.id,
        target_event=target,
        reason=reason,
        reason_code=target.void_reason_code,
    )
