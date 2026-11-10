"""Permit arbitration precedes every release effect and canonical inventory debit."""

from dataclasses import replace
from typing import Any, cast
from zoneinfo import ZoneInfo

from core.time import server_now
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext, EventHandler, register
from people.eligibility import AssessmentQuery, assess_training_eligibility
from people.permissions import PeopleContext
from releases.models import Permit, PermitSuspension, PermitVersion, Release, ReleaseDevice
from releases.payloads import ReleasePayload
from releases.safety import PermitSafety, reject, validate_permit_safety
from releases.selectors import current_device_status, current_permit_version, device_status_at
from scheduling.models import ScheduledTask
from uploads.access import UploadActor, current_scope

RELEASE_CODES = (
    "release_inaccessible",
    "release_permit_expired",
    "release_permit_suspended",
    "release_zone_invalid",
    "release_training_invalid",
    "release_schedule_invalid",
    "release_lot_blocked",
    "release_stock_unavailable",
    "release_gps_unusable",
    "release_configuration_unavailable",
    "release_device_unavailable",
    "release_evidence_required",
    "release_void_blocked",
    "release_transit_review_required",
)


def resolve_release_context(ctx: EventContext, values: dict[str, Any]) -> Permit:
    permit = Permit.objects.filter(organization=ctx.organization, pk=values["permit_id"]).first()
    if permit is None or not current_scope(
        UploadActor(ctx.user, ctx.organization, ctx.device.pk)
    ).allows("field_event.sync", str(permit.center_id), str(permit.quadrant_id)):
        reject("release_inaccessible")
    return cast(Permit, permit)


def _versions(ctx: EventContext, permit: Permit) -> tuple[PermitVersion, PermitVersion]:
    if PermitSuspension.objects.filter(organization=ctx.organization, permit=permit).exists():
        reject("release_permit_suspended")
    captured = current_permit_version(permit, ctx.envelope.device_time)
    current = current_permit_version(permit, server_now())
    if captured is None or current is None:
        reject("release_permit_expired")
    for version, at in ((captured, ctx.envelope.device_time), (current, server_now())):
        validate_permit_safety(
            PermitSafety(
                version.valid_from, version.valid_to, version.geometry, version.type.requirements
            ),
            at,
            ctx.envelope.gps,
        )
    return captured, current


def _device(ctx: EventContext, values: dict[str, Any], permit: Permit) -> ReleaseDevice:
    device = ReleaseDevice.objects.filter(
        organization=ctx.organization,
        pk=values["release_device_id"],
        source_lot_id=values["lot_id"],
        center_id=permit.center_id,
        quadrant_id=permit.quadrant_id,
        status="active",
    ).first()
    if (
        device is None
        or current_device_status(device) != "active"
        or device_status_at(device, ctx.envelope.device_time) != "active"
    ):
        reject("release_device_unavailable")
    return cast(ReleaseDevice, device)


def _training(ctx: EventContext, values: dict[str, Any], permit: Permit) -> dict[str, Any]:
    now = server_now()
    facts = {}
    for label, at in (("capture", ctx.envelope.device_time), ("current", now)):
        assessment = assess_training_eligibility(
            AssessmentQuery(
                ctx.organization,
                ctx.user.pk,
                "release.record",
                PeopleContext(permit.center_id, permit.quadrant_id),
                at,
                at,
            )
        )
        if (
            not assessment["training_eligible"]
            or str(values["training_version"]) not in assessment["training_version_ids"]
        ):
            reject("release_training_invalid")
        facts[label] = assessment
    return facts


def _schedule(ctx: EventContext, values: dict[str, Any], permit: Permit) -> dict[str, str]:
    from releases.models import ReleaseSchedule

    task = ScheduledTask.objects.filter(
        organization=ctx.organization,
        pk=values["schedule_task_id"],
        action="release",
        point__block__quadrant_id=permit.quadrant_id,
        due_date=ctx.envelope.device_time.astimezone(ZoneInfo(ctx.organization.timezone)).date(),
        created_at__lte=ctx.envelope.device_time,
    ).first()
    owner = None if task is None else task.ownerships.order_by("-revision").first()
    captured_owner = (
        None
        if task is None
        else task.ownerships.filter(created_at__lte=ctx.envelope.device_time)
        .order_by("-revision")
        .first()
    )
    plan = (
        None
        if task is None
        else ReleaseSchedule.objects.filter(
            organization=ctx.organization,
            task=task,
            created_at__lte=ctx.envelope.device_time,
            permit_version=current_permit_version(permit, ctx.envelope.device_time),
        ).first()
    )
    if (
        task is None
        or owner is None
        or owner.courier_id != ctx.user.pk
        or captured_owner is None
        or captured_owner.courier_id != ctx.user.pk
        or plan is None
        or Release.objects.filter(schedule_task=task).exists()
    ):
        reject("release_schedule_invalid")
    return {
        "task_id": str(task.pk),
        "plan_id": str(plan.pk),
        "capture_owner_id": str(captured_owner.pk),
        "permit_version_id": str(plan.permit_version_id),
    }


def capture_release_facts(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    permit = resolve_release_context(ctx, values)
    captured, current = _versions(ctx, permit)
    device = _device(ctx, values, permit)
    training = _training(ctx, values, permit)
    schedule = _schedule(ctx, values, permit)
    if (
        not ctx.envelope.rules_version
        or not ctx.envelope.catalog_version
        or ctx.envelope.shift_id is None
    ):
        reject("release_configuration_unavailable")
    facts = {
        "permit_version": str(captured.pk),
        "current_permit_version": str(current.pk),
        "permit_type": str(captured.type_id),
        "requirements": captured.type.requirements,
        "official_document": str(captured.official_document_id),
        "training": training,
        "source_payload_hash": ctx.envelope.payload_info.sha256,
        "rules_version": ctx.envelope.rules_version,
        "catalog_version": ctx.envelope.catalog_version,
        "source_lot_version": str(device.source_lot_version_id),
        "schedule": schedule,
    }
    if ctx.review_authorization is not None and ctx.review_authorization.reviewer_actor is not None:
        facts["transit_reviewer_id"] = str(ctx.review_authorization.reviewer_actor.user.pk)
    ctx.observed_facts["release"] = facts
    return facts


def prepare_release(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    try:
        return _prepare_release(ctx, values)
    except EventRejected as error:
        raise EventRejected(error.code, {**error.params, "severity": "critical"}) from error


def _prepare_release(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    from inventory.transactions import require_inventory_lock
    from releases.stock import validate_release_stock

    require_inventory_lock(ctx.organization.pk)
    permit = resolve_release_context(ctx, values)
    Permit.objects.select_for_update(nowait=True, no_key=True).get(pk=permit.pk)
    facts = capture_release_facts(ctx, values)
    _evidence(replace(ctx, review_code=None), values)
    stock = validate_release_stock(ctx, values["lot_id"], values["quantity"])
    return {**facts, "stock": stock.provenance()}


def apply_release(ctx: EventContext, values: dict[str, Any]) -> Release:
    from releases.stock import append_release_stock, validate_release_stock

    facts = prepare_release(ctx, values)
    if ctx.review_code and not ctx.acknowledges(ctx.review_code):
        raise EventNeedsReview(ctx.review_code)
    stock = validate_release_stock(ctx, values["lot_id"], values["quantity"])
    gps = ctx.envelope.gps
    release = Release.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        declared_event_id=ctx.envelope.id,
        permit_version_id=facts["permit_version"],
        lot_id=values["lot_id"],
        release_device_id=values["release_device_id"],
        training_version_id=values["training_version"],
        schedule_task_id=values["schedule_task_id"],
        quantity=values["quantity"],
        location=[gps.lng, gps.lat] if gps else [],
        device_time=ctx.envelope.device_time,
        server_received_at=ctx.server_received_at,
        provenance=facts,
    )
    append_release_stock(release, stock)
    from releases.planning import publish_release_completion

    publish_release_completion(UploadActor(ctx.user, ctx.organization, ctx.device.pk), release)
    return cast(Release, release)


def _evidence(ctx: EventContext, values: dict[str, Any]) -> None:
    from uploads.gates import require_event_evidence

    try:
        require_event_evidence(ctx, [str(value) for value in values["evidence_ids"]])
    except EventNeedsReview as error:
        if error.code in {"clock_skew", "final_upload_after_revoke", "causal_parent_pending"}:
            raise
        reject("release_evidence_required")


def _apply(ctx: EventContext, values: dict[str, Any]) -> None:
    apply_release(ctx, values)


def _void(ctx: EventContext, target: FieldEvent) -> None:
    if (
        target.status == "in_review"
        and not Release.objects.filter(
            organization=ctx.organization, declared_event_id=target.pk
        ).exists()
    ):
        resolve_release_context(ctx, target.payload)
        return
    raise EventRejected("release_void_blocked", {"reason": "physical_consumption_retained"})


def register_release_handler() -> None:
    from releases.review import ReleaseReviewAdapter

    register(
        EventHandler(
            "release.record",
            1,
            ReleasePayload,
            _apply,
            on_void=_void,
            codes=RELEASE_CODES,
            review_adapter=ReleaseReviewAdapter(),
        )
    )
