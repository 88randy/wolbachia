"""Origin of an egg paddle in one read: bag, reading, ovitrap, point, block, quadrant, center.

Read-only and additive. The chain is loaded in a constant number of queries. Nothing numeric is
returned (no egg counts), so the blind-QA rules cannot be bypassed here: the lab part is only
published when `published_bag_lab_page` (the same gate as `GET /bags/{id}/`) already allows it.
"""

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404

from core.author_names import resolve_author_names
from geography.geometry import distance_m
from geography.models import BlockVersion, QuadrantVersion
from lab.access import scoped_readings
from lab.models import EggCountAttempt, LabRejection, RecountAttempt
from lab.samples.models import WolbachiaSample
from organizations.scope import EffectiveScope
from ovitraps.models import Bag, OvitrapReading
from ovitraps.permissions import READING_READ
from uploads.access import UploadActor
from uploads.models import AttachmentLink

SECONDS_PER_DAY = 86400
SAMPLE_READ = "sample.read"
PCR_READ = "pcr.read"
COUNT_READ = "egg_count.read"


def exposure_days(installed_at: datetime, collected_at: datetime) -> int | None:
    """Whole days the paddle stayed in the field (rounded to the nearest day); None if negative."""
    seconds = (collected_at - installed_at).total_seconds()
    if seconds < 0:
        return None
    days = Decimal(seconds) / SECONDS_PER_DAY
    return int(days.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


def _actor(names: dict[str, str], user_id: UUID | None) -> dict[str, Any] | None:
    if user_id is None:
        return None
    return {"id": str(user_id), "name": names.get(str(user_id), "")}


def _trace_bag(actor: UploadActor, code: str) -> Bag:
    rows: QuerySet[Bag] = Bag.objects.filter(
        organization=actor.organization,
        reading__in=scoped_readings(actor, READING_READ),
    ).select_related(
        "reading__event",
        "reading__ovitrap__event",
        "reading__ovitrap__sampling_point__block__quadrant__center",
        "reading__point_version",
        "reading__paddle_type",
        "lab_receipt",
    )
    return get_object_or_404(rows, code=code)


def _installed(reading: OvitrapReading) -> dict[str, Any]:
    """When the paddle went into the trap: the previous check of that ovitrap, else its placement."""
    previous = (
        OvitrapReading.objects.filter(
            organization_id=reading.organization_id,
            ovitrap_id=reading.ovitrap_id,
            event__voided_at__isnull=True,
            event__device_time__lt=reading.event.device_time,
        )
        .select_related("event")
        .order_by("-event__device_time")
        .first()
    )
    if previous is not None:
        event = previous.event
        basis = "previous_reading"
    else:
        event = reading.ovitrap.event
        basis = "placement"
    return {
        "at": event.device_time,
        "by": event.created_by_id,
        "basis": basis,
        "days": exposure_days(event.device_time, reading.event.device_time),
    }


def _geometry(model: Any, field: str, row: Any) -> dict[str, Any] | None:  # noqa: ANN401 -- two version models
    version = model.objects.filter(**{field: row}).order_by("-revision").first()
    return None if version is None else dict(version.geometry)


def _photos(reading: OvitrapReading) -> list[dict[str, str]]:
    links = AttachmentLink.objects.filter(
        field_event_id=reading.event_id, upload__content_type__startswith="image/"
    ).select_related("upload")
    return [
        {"id": str(link.upload.public_id), "content_type": link.upload.content_type}
        for link in links.order_by("created_at")
    ]


def _location(reading: OvitrapReading) -> dict[str, Any]:
    ovitrap = reading.ovitrap
    point = ovitrap.sampling_point
    block = point.block
    quadrant = block.quadrant
    return {
        "ovitrap": {"id": str(ovitrap.client_uuid), "code": ovitrap.code},
        "point": {
            "id": str(point.pk),
            "code": point.code,
            "location": [float(value) for value in reading.point_version.location],
            "version": reading.point_version.version,
        },
        "block": {
            "id": str(block.pk),
            "code": block.code,
            "geometry": _geometry(BlockVersion, "block", block),
        },
        "quadrant": {
            "id": str(quadrant.pk),
            "code": quadrant.code,
            "geometry": _geometry(QuadrantVersion, "quadrant", quadrant),
        },
        "center": {
            "id": str(quadrant.center_id),
            "code": quadrant.center.code,
            "name": quadrant.center.name,
        },
    }


def _capture(reading: OvitrapReading) -> dict[str, Any] | None:
    event = reading.event
    if event.gps_lat is None or event.gps_lng is None:
        return None
    point = [float(reading.point_version.location[0]), float(reading.point_version.location[1])]
    return {
        "lat": event.gps_lat,
        "lng": event.gps_lng,
        "accuracy_m": event.gps_accuracy_m,
        "distance_to_point_m": round(distance_m([event.gps_lng, event.gps_lat], point), 1),
    }


def _lab_counts(bag: Bag) -> list[EggCountAttempt]:
    return list(
        EggCountAttempt.objects.filter(bag=bag).select_related("void_fact").order_by("ordinal")
    )


def _wolbachia(
    reading: OvitrapReading, scope: EffectiveScope
) -> list[tuple[WolbachiaSample, bool]]:
    block_quadrant = reading.ovitrap.sampling_point.block.quadrant
    center, quadrant = str(block_quadrant.center_id), str(block_quadrant.pk)
    if not scope.allows(SAMPLE_READ, center, quadrant):
        return []
    samples = list(
        WolbachiaSample.objects.filter(reading=reading)
        .prefetch_related("attempts", "receipt")
        .order_by("created_at")
    )
    with_pcr = scope.allows(PCR_READ, center, quadrant)
    return [(sample, with_pcr) for sample in samples]


def _lab(bag: Bag, scope: EffectiveScope, status: dict[str, Any]) -> dict[str, Any]:
    """Dates and authors of the lab steps; never a number."""
    reading = bag.reading
    quadrant = reading.ovitrap.sampling_point.block.quadrant
    center_id, quadrant_id = str(quadrant.center_id), str(quadrant.pk)
    counts = _lab_counts(bag)
    rejections = list(LabRejection.objects.filter(bag=bag).select_related("void_fact"))
    recounts: list[RecountAttempt] = []
    if scope.allows(COUNT_READ, center_id, quadrant_id):
        recounts = list(RecountAttempt.objects.filter(bag=bag).order_by("created_at"))
    samples = _wolbachia(reading, scope)
    pcr_rows: dict[UUID, list[Any]] = {}
    if any(with_pcr for _sample, with_pcr in samples):
        from lab.pcr.models import PcrResult

        for result in PcrResult.objects.filter(
            sample_id__in=[sample.pk for sample, _ in samples], void__isnull=True
        ).order_by("created_at"):
            pcr_rows.setdefault(result.sample_id, []).append(result)
    receipt = getattr(bag, "lab_receipt", None)
    voids = [row.void_fact for row in (*counts, *rejections) if hasattr(row, "void_fact")]
    user_ids = [
        *(row.created_by_id for row in (*counts, *rejections, *recounts, *voids)),
        *([] if receipt is None else [receipt.created_by_id]),
        *(attempt.created_by_id for sample, _ in samples for attempt in sample.attempts.all()),
        *(row.created_by_id for rows in pcr_rows.values() for row in rows),
    ]
    names = resolve_author_names(bag.organization_id, user_ids)

    def void_of(row: Any) -> dict[str, Any] | None:  # noqa: ANN401
        void = getattr(row, "void_fact", None)
        if void is None:
            return None
        return {
            "at": _iso(void.created_at),
            "by": _actor(names, void.created_by_id),
            "reason_code": void.reason_code,
            "reason": void.reason,
        }

    return {
        "status": status["status"],
        "receipt": None
        if receipt is None
        else {"at": _iso(receipt.created_at), "by": _actor(names, receipt.created_by_id)},
        "counts": [
            {
                "id": str(row.pk),
                "ordinal": row.ordinal,
                "at": _iso(row.created_at),
                "by": _actor(names, row.created_by_id),
                "replaces": None if row.replacement_of_id is None else str(row.replacement_of_id),
                "void": void_of(row),
            }
            for row in counts
        ],
        "rejections": [
            {
                "id": str(row.pk),
                "at": _iso(row.created_at),
                "by": _actor(names, row.created_by_id),
                "reason": row.reason,
                "void": void_of(row),
            }
            for row in rejections
        ],
        "recounts": [
            {"role": row.role, "at": _iso(row.created_at), "by": _actor(names, row.created_by_id)}
            for row in recounts
        ],
        "wolbachia": [
            {
                "sample_code": sample.code,
                "received_at": _iso(getattr(getattr(sample, "receipt", None), "created_at", None)),
                "results": [
                    {
                        "revision": attempt.revision,
                        "status": attempt.status,
                        "result": attempt.result,
                        "at": _iso(attempt.created_at),
                        "by": _actor(names, attempt.created_by_id),
                    }
                    for attempt in sample.attempts.all()
                ],
                "pcr": [
                    {
                        "target": row.target,
                        "outcome": row.outcome,
                        "at": _iso(row.created_at),
                        "by": _actor(names, row.created_by_id),
                    }
                    for row in pcr_rows.get(sample.pk, [])
                ],
            }
            for sample, _with_pcr in samples
        ],
    }


def bag_trace(actor: UploadActor, scope: EffectiveScope, code: str) -> dict[str, Any]:
    """The whole origin of the bag with this human code, within the actor's scope."""
    from lab.selectors import published_bag_lab_page

    bag = _trace_bag(actor, code)
    reading = bag.reading
    event = reading.event
    installed = _installed(reading)
    published = published_bag_lab_page(actor, [bag])[bag.pk]
    user_ids = [event.created_by_id, installed["by"], bag.collector_id]
    names = resolve_author_names(bag.organization_id, user_ids)
    paddle_type = reading.paddle_type
    return {
        "bag": {"id": str(bag.pk), "code": bag.code},
        "reading": {
            "id": str(reading.pk),
            "device_time": _iso(event.device_time),
            "server_received_at": _iso(event.server_received_at),
            "courier": _actor(names, bag.collector_id),
            "paddle_present": reading.paddle_present,
            "has_eggs": reading.has_eggs,
            "paddle_type": None
            if paddle_type is None
            else {
                "code": paddle_type.code,
                "label_es": paddle_type.label_es,
                "label_en": paddle_type.label_en,
            },
            "finding_code": reading.finding_code,
            "epi_week": reading.epi_week,
            "is_lagged": reading.is_lagged,
            "voided_at": _iso(event.voided_at),
            "void_reason": event.void_reason,
            "capture": _capture(reading),
            "photos": _photos(reading),
        },
        "installed": {
            "at": _iso(installed["at"]),
            "by": _actor(names, installed["by"]),
            "basis": installed["basis"],
            "exposure_days": installed["days"],
        },
        "location": _location(reading),
        "lab": None if published is None else _lab(bag, scope, published),
    }
