"""Genuine sample source identities under the captured courier's complete paired grants."""

from datetime import datetime
from typing import Any

from django.db.models import QuerySet

from field_sync.models import FieldEvent
from field_sync.producers import ProducerContext
from inventory.models import Lot, LotVersion
from inventory.transfers.scope import paired_query
from lab.samples.models import SampleReceipt
from ovitraps.models import OvitrapReading
from releases.models import Release
from reviews.effect_receipts import effective_effects

CAPTURE_PERMISSIONS = ("field.bootstrap", "field_event.sync", "sample.collect")


def capture_pair_allowed(ctx: ProducerContext, center: Any, quadrant: Any) -> bool:  # noqa: ANN401 -- UUID or nullable source dimensions
    return all(
        ctx.scope.allows(code, str(center), None if quadrant is None else str(quadrant))
        for code in CAPTURE_PERMISSIONS
    )


def _scoped(rows: QuerySet[Any], ctx: ProducerContext, lookups: tuple[str, str]) -> QuerySet[Any]:
    from django.db.models import Q

    for permission in CAPTURE_PERMISSIONS:
        allowed = Q(pk__in=[])
        for codes, scope in ctx.scope.grants:
            if permission in codes:
                allowed |= paired_query(scope, *lookups)
        rows = rows.filter(allowed)
    return rows.filter(organization=ctx.organization)


def _observed(ctx: ProducerContext, boundaries: list[datetime], *clocks: datetime) -> bool:
    future = [value for value in clocks if value > ctx.now]
    boundaries.extend(future)
    return not future


def _row(kind: str, row: Any, label: str, center: Any, quadrant: Any) -> dict[str, Any]:  # noqa: ANN401, PLR0913 -- three canonical source variants share one closed response schema
    return {
        "kind": kind,
        "id": str(row.pk),
        "label": label,
        "center_id": str(center),
        "quadrant_id": None if quadrant is None else str(quadrant),
        "author_id": None,
        "event_id": None,
        "device_time": None,
        "created_at": row.created_at.isoformat(),
        "effective": True,
        "lot_version_id": None,
        "lot_version_revision": None,
        "lot_version_created_at": None,
    }


def _readings(ctx: ProducerContext, boundaries: list[datetime]) -> list[dict[str, Any]]:
    base = OvitrapReading.objects.filter(
        event__organization=ctx.organization,
        event__created_by=ctx.user,
        ovitrap__organization=ctx.organization,
        ovitrap__sampling_point__organization=ctx.organization,
        ovitrap__sampling_point__block__organization=ctx.organization,
        ovitrap__sampling_point__block__quadrant__organization=ctx.organization,
        ovitrap__sampling_point__block__quadrant__center__organization=ctx.organization,
    )
    scoped = _scoped(
        base, ctx, (OvitrapReading.scope_center_lookup, OvitrapReading.scope_quadrant_lookup)
    )
    rows = (
        effective_effects(scoped, "event")
        .select_related("event", "ovitrap__sampling_point__block__quadrant")
        .order_by("pk")
    )
    result = []
    for reading in rows:
        source = reading.event
        if not _observed(
            ctx, boundaries, reading.created_at, source.created_at, source.device_time
        ):
            continue
        point = reading.ovitrap.sampling_point
        quadrant = point.block.quadrant
        row = _row("reading", reading, point.code, quadrant.center_id, quadrant.pk)
        row.update(
            author_id=str(source.created_by_id),
            event_id=str(source.pk),
            device_time=source.device_time.isoformat(),
        )
        result.append(row)
    return result


def _releases(ctx: ProducerContext, boundaries: list[datetime]) -> list[dict[str, Any]]:
    rows = (
        _scoped(
            Release.objects.filter(
                created_by=ctx.user,
                permit_version__organization=ctx.organization,
                permit_version__permit__organization=ctx.organization,
                permit_version__permit__center__organization=ctx.organization,
                permit_version__permit__quadrant__organization=ctx.organization,
                release_device__organization=ctx.organization,
            ),
            ctx,
            (Release.scope_center_lookup, Release.scope_quadrant_lookup),
        )
        .select_related("permit_version__permit", "release_device")
        .order_by("pk")
    )
    releases = list(rows)
    events = {
        event.pk: event
        for event in effective_effects(
            FieldEvent.objects.filter(
                organization=ctx.organization,
                created_by=ctx.user,
                pk__in=[row.declared_event_id for row in releases],
            )
        )
    }
    result = []
    for release in releases:
        source = events.get(release.declared_event_id)
        if source is None or not _observed(
            ctx, boundaries, release.created_at, source.created_at, source.device_time
        ):
            continue
        permit = release.permit_version.permit
        row = _row(
            "release", release, release.release_device.code, permit.center_id, permit.quadrant_id
        )
        row.update(
            author_id=str(source.created_by_id),
            event_id=str(source.pk),
            device_time=source.device_time.isoformat(),
        )
        result.append(row)
    return result


def _lots(ctx: ProducerContext, boundaries: list[datetime]) -> list[dict[str, Any]]:
    from django.db.models import F, Prefetch, Q

    rows = (
        _scoped(
            Lot.objects.filter(center__organization=ctx.organization).filter(
                Q(quadrant__isnull=True)
                | Q(quadrant__organization=ctx.organization, quadrant__center_id=F("center_id"))
            ),
            ctx,
            ("center_id", "quadrant_id"),
        )
        .prefetch_related(
            Prefetch(
                "versions",
                queryset=LotVersion.objects.filter(organization=ctx.organization).order_by(
                    "-revision"
                ),
            )
        )
        .order_by("pk")
    )
    result = []
    for lot in rows:
        if not _observed(ctx, boundaries, lot.created_at):
            continue
        versions = []
        for version in lot.versions.all():
            if _observed(ctx, boundaries, version.created_at):
                versions.append(version)
        if not versions:
            continue
        version = versions[0]
        row = _row("lot", lot, lot.code, lot.center_id, lot.quadrant_id)
        row.update(
            lot_version_id=str(version.pk),
            lot_version_revision=version.revision,
            lot_version_created_at=version.created_at.isoformat(),
        )
        result.append(row)
    return result


def capture_sources(ctx: ProducerContext) -> tuple[list[dict[str, Any]], list[datetime]]:
    boundaries: list[datetime] = []
    return [
        *_readings(ctx, boundaries),
        *_lots(ctx, boundaries),
        *_releases(ctx, boundaries),
    ], boundaries


def capture_receipts(ctx: ProducerContext, sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    visible = {(row["kind"], row["id"]) for row in sources}
    receipts = (
        SampleReceipt.objects.filter(
            organization=ctx.organization,
            created_at__lte=ctx.now,
            sample__organization=ctx.organization,
            sample__created_by=ctx.user,
            sample__event__organization=ctx.organization,
            sample__event__created_by=ctx.user,
        )
        .select_related("sample", "sample__event")
        .order_by("sample_id")
    )
    result = []
    for receipt in receipts:
        sample = receipt.sample
        reference = sample.event.payload.get("source_ref", {})
        if (
            not isinstance(reference, dict)
            or (reference.get("kind"), reference.get("id")) not in visible
            or not capture_pair_allowed(ctx, sample.center_id, sample.quadrant_id)
        ):
            continue
        result.append(
            {
                "sample_id": str(sample.pk),
                "event_id": str(sample.event_id),
                "received_at": receipt.created_at.isoformat(),
            }
        )
    return result
