"""Field readings, lab counts, decisions, voids and fuel/service facts for the record history.

Each builder returns only the sources the caller may read (`can_read`), so a profile without
`reading.read` or `egg_count.read` never sees those rows in a history it can otherwise open.
"""

from collections.abc import Callable
from typing import Any

from django.db.models import Q

from discovery.timeline import RowSource, TimelineEntry, _entry
from fleet.models import FuelLoad, ServiceRecord
from geography.decisions.models import QuadrantClosure
from lab.models import EggCountAttempt
from lab.permissions import COUNT_READ
from ovitraps.models import Ovitrap, OvitrapReading, OvitrapVoid, RelocationDecision
from ovitraps.permissions import OVITRAP_READ, READING_READ, RELOCATION_READ

CanRead = Callable[[str], bool]


def point_extra_sources(record: Any, can_read: CanRead) -> list[RowSource]:  # noqa: ANN401
    traps = Ovitrap.objects.filter(sampling_point=record)
    readings = OvitrapReading.objects.filter(ovitrap__sampling_point=record)
    sources: list[RowSource] = []

    def placed(row: Ovitrap) -> TimelineEntry:
        return _entry("ovitrap", row, "ovitrap.placed", row.created_at, row.created_by)

    def reading(row: OvitrapReading) -> TimelineEntry:
        return _entry(
            "reading",
            row,
            "reading.recorded",
            row.created_at,
            row.created_by,
            params={
                "finding_code": row.finding_code,
                "paddle_present": row.paddle_present,
                "has_eggs": row.has_eggs,
                "epi_week": row.epi_week,
            },
        )

    def count(row: EggCountAttempt) -> TimelineEntry:
        return _entry(
            "lab_count",
            row,
            "lab.count",
            row.created_at,
            row.created_by,
            params={"value": row.value, "ordinal": row.ordinal},
        )

    def decision(row: RelocationDecision) -> TimelineEntry:
        return _entry(
            "relocation_decision",
            row,
            "relocation.decision",
            row.decided_at or row.created_at,
            row.created_by,
            reason=row.reason or None,
            params={"decision": row.decision},
        )

    def void(row: OvitrapVoid) -> TimelineEntry:
        return _entry(
            "ovitrap_void",
            row,
            "record.void",
            row.created_at,
            row.created_by,
            reason=row.reason or None,
            params={"reason_code": row.reason_code},
        )

    if can_read(OVITRAP_READ):
        sources.append(
            RowSource("ovitrap", traps.select_related("created_by"), "created_at", placed)
        )
        targets = Q(target_event__in=traps.values("event_id")) | Q(
            target_event__in=readings.values("event_id")
        )
        sources.append(
            RowSource(
                "ovitrap_void",
                OvitrapVoid.objects.filter(targets).select_related("created_by"),
                "created_at",
                void,
            )
        )
    if can_read(READING_READ):
        sources.append(
            RowSource("reading", readings.select_related("created_by"), "created_at", reading)
        )
    if can_read(COUNT_READ):
        counts = EggCountAttempt.objects.filter(bag__reading__ovitrap__sampling_point=record)
        sources.append(
            RowSource("lab_count", counts.select_related("created_by"), "created_at", count)
        )
    if can_read(RELOCATION_READ):
        decisions = RelocationDecision.objects.filter(proposal__ovitrap__sampling_point=record)
        sources.append(
            RowSource(
                "relocation_decision",
                decisions.select_related("created_by"),
                "created_at",
                decision,
            )
        )
    return sources


def quadrant_extra_sources(record: Any) -> list[RowSource]:  # noqa: ANN401
    def closure(row: QuadrantClosure) -> TimelineEntry:
        return _entry(
            "quadrant_closure",
            row,
            "quadrant.closed",
            row.closed_at,
            row.created_by,
            params={"revision": row.quadrant_version.revision},
        )

    rows = QuadrantClosure.objects.filter(quadrant_version__quadrant=record)
    return [
        RowSource(
            "quadrant_closure",
            rows.select_related("created_by", "quadrant_version"),
            "closed_at",
            closure,
        )
    ]


def motorcycle_extra_sources(record: Any) -> list[RowSource]:  # noqa: ANN401
    def fuel(row: FuelLoad) -> TimelineEntry:
        return _entry(
            "fuel_load",
            row,
            "fuel.load",
            row.created_at,
            row.created_by,
            params={"litres": str(row.litres), "odometer_km": row.odometer_km},
        )

    def service(row: ServiceRecord) -> TimelineEntry:
        return _entry(
            "service_record",
            row,
            "service.record",
            row.created_at,
            row.created_by,
            params={"kind": row.kind, "odometer_km": row.odometer_km},
        )

    def service_void(row: ServiceRecord) -> TimelineEntry:
        return _entry(
            "service_void",
            row,
            "record.void",
            row.voided_at,  # type: ignore[arg-type]
            row.voided_by,
            reason=row.void_reason or None,
            params={"reason_code": row.void_reason_code},
        )

    services = ServiceRecord.objects.filter(motorcycle=record)
    return [
        RowSource(
            "fuel_load",
            FuelLoad.objects.filter(motorcycle=record).select_related("created_by"),
            "created_at",
            fuel,
        ),
        RowSource("service_record", services.select_related("created_by"), "created_at", service),
        RowSource(
            "service_void",
            services.filter(voided_at__isnull=False).select_related("voided_by"),
            "voided_at",
            service_void,
        ),
    ]
