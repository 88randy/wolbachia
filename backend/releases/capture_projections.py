"""Own read-only release prerequisites; cached capture is never server authorization."""

from dataclasses import replace
from typing import Any

from django.core.exceptions import ImproperlyConfigured
from django.db.models import QuerySet

from core.snapshots import snapshot_hash
from field_sync.producers import ProducerContext, filter_producer_rows
from releases.capture_stock import capture_custody, capture_receipt_lines
from releases.models import Permit, Release, ReleaseDevice, ReleaseSchedule
from releases.selectors import (
    current_device_status,
    current_permit_version,
    device_revision,
    permit_blockers,
    permit_revision,
)


def _paired_permits(ctx: ProducerContext) -> list[Permit]:
    rows: QuerySet[Permit] = Permit.objects.all().order_by("pk")
    for permission in ("field.bootstrap", "field_event.sync"):
        rows = filter_producer_rows(
            rows, replace(ctx, permission=permission), ("center_id", "quadrant_id")
        )
    return list(rows)


def _capture_tasks(ctx: ProducerContext, permit: Permit) -> list[dict[str, Any]]:
    plans = (
        ReleaseSchedule.objects.filter(
            organization=ctx.organization,
            permit_version__permit=permit,
            task__action="release",
            task__point__block__quadrant_id=permit.quadrant_id,
            created_at__lte=ctx.now,
            task__created_at__lte=ctx.now,
        )
        .select_related("task", "permit_version")
        .order_by("task_id")
    )
    tasks = []
    for plan in plans:
        owner = plan.task.ownerships.order_by("-revision").first()
        if owner is None or owner.courier_id != ctx.user.pk or owner.created_at > ctx.now:
            continue
        tasks.append(
            {
                "id": str(plan.task_id),
                "point_id": str(plan.task.point_id),
                "permit_id": str(permit.pk),
                "permit_version_id": str(plan.permit_version_id),
                "courier_id": str(owner.courier_id),
                "due_date": plan.task.due_date.isoformat(),
                "owner_revision": owner.revision,
                "is_completed": Release.objects.filter(
                    organization=ctx.organization, schedule_task=plan.task
                ).exists(),
                "created_at": plan.task.created_at.isoformat(),
                "binding_created_at": plan.created_at.isoformat(),
                "owner_created_at": owner.created_at.isoformat(),
            }
        )
    return tasks


def _capture_devices(ctx: ProducerContext, permit: Permit) -> list[dict[str, Any]]:
    receipts = list(capture_receipt_lines(ctx, permit))
    devices = (
        ReleaseDevice.objects.filter(
            organization=ctx.organization,
            center_id=permit.center_id,
            quadrant_id=permit.quadrant_id,
            source_lot_id__in={line.release_line.line.lot_id for line in receipts},
            created_at__lte=ctx.now,
        )
        .select_related("source_lot", "source_lot_version")
        .order_by("pk")
    )
    return [
        {
            "id": str(device.pk),
            "code": device.code,
            "status": current_device_status(device),
            "revision": device_revision(device),
            "created_at": device.created_at.isoformat(),
            "source_lot_id": str(device.source_lot_id),
            "source_lot_version_id": str(device.source_lot_version_id),
            "custody": [
                capture_custody(ctx, line, device)
                for line in receipts
                if line.release_line.line.lot_id == device.source_lot_id
            ],
        }
        for device in devices
    ]


def _capture(ctx: ProducerContext, permit: Permit) -> dict[str, Any]:
    body = {"devices": _capture_devices(ctx, permit), "tasks": _capture_tasks(ctx, permit)}
    return {"as_of": ctx.now.isoformat(), "version": snapshot_hash(body), **body}


def prepare_release_capture(ctx: ProducerContext) -> ProducerContext:
    """Compute once from the captured scope; no new membership read, lock or write."""
    payloads = {}
    versions = []
    for permit in _paired_permits(ctx):
        captured = _capture(ctx, permit)
        payloads[str(permit.pk)] = captured
        version = current_permit_version(permit)
        versions.append(
            {
                "permit": str(permit.pk),
                "revision": permit_revision(permit),
                "permit_version": None if version is None else str(version.pk),
                "blockers": permit_blockers(permit),
                "capture": captured["version"],
            }
        )
    return replace(
        ctx,
        release_capture_payloads=payloads,
        release_visibility_revision=snapshot_hash({"permits": versions}),
        release_capture_frame=_capture_frame(ctx, payloads),
    )


def _capture_frame(
    ctx: ProducerContext, payloads: dict[str, dict[str, Any]]
) -> tuple[str, str, str, str, str]:
    grants = [{"codes": sorted(codes), "scope": scope} for codes, scope in ctx.scope.grants]
    return (
        str(ctx.organization.pk),
        str(ctx.user.pk),
        snapshot_hash({"grants": grants}),
        ctx.now.isoformat(),
        snapshot_hash(payloads),
    )


def bound_release_capture(ctx: ProducerContext) -> ProducerContext:
    if ctx.release_capture_payloads is None:
        return prepare_release_capture(ctx)
    if ctx.release_capture_frame != _capture_frame(ctx, ctx.release_capture_payloads):
        raise ImproperlyConfigured("Prepared release capture context changed.")
    return ctx


def capture_content(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Observation time changes neither dependency identities nor conditional bootstrap content."""
    return [
        {
            **row,
            "capture": None
            if row.get("capture") is None
            else {key: value for key, value in row["capture"].items() if key != "as_of"},
        }
        for row in rows
    ]
