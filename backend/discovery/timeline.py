"""Unified provenance timeline of one authorized record, newest first, with a stable cursor.

Each source is an existing append-only table. The order key is (time, source type, row id), so a
cursor stays valid when rows are added. Related references carry human codes only and are listed
only when the caller can read the referenced record.
"""

import base64
import binascii
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict
from uuid import UUID

from django.db.models import Q, QuerySet

from core.exceptions import FieldValidationError
from field_sync.models import FieldEvent
from geography.models import ExcludedPointResolution, PointVersion, QuadrantVersion
from incidents.models import IncidentEvent
from lab.shipments.models import ShipmentVoid, UiebShipment
from shifts.models import Motorcycle, MotorcycleBlockEvent

REASON_ACTIONS = frozenset({"close", "void"})


class TimelineEntry(TypedDict):
    source_type: str
    source_id: str
    occurred_at: datetime
    kind: str
    author: dict[str, str] | None
    reason: str | None
    refs: list[dict[str, str]]
    params: dict[str, Any]


@dataclass(frozen=True)
class Cursor:
    at: datetime
    source_type: str
    source_id: UUID

    def encode(self) -> str:
        raw = json.dumps([self.at.isoformat(), self.source_type, str(self.source_id)])
        return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(value: str) -> Cursor:
    try:
        padded = value + "=" * (-len(value) % 4)
        at, source_type, source_id = json.loads(base64.urlsafe_b64decode(padded.encode()))
        return Cursor(datetime.fromisoformat(at), str(source_type), UUID(source_id))
    except (ValueError, TypeError, binascii.Error) as error:
        raise FieldValidationError("cursor", "invalid_cursor") from error


@dataclass(frozen=True)
class RowSource:
    """One table of the timeline: rows, the column that orders them, and the entry builder."""

    source_type: str
    rows: QuerySet[Any]
    time_field: str
    build: Callable[[Any], TimelineEntry]

    def page(self, cursor: Cursor | None, limit: int) -> list[TimelineEntry]:
        rows = self.rows.filter(self._before(cursor)).order_by(f"-{self.time_field}", "-pk")
        return [self.build(row) for row in rows[:limit]]

    def _before(self, cursor: Cursor | None) -> Q:
        if cursor is None:
            return Q()
        field = self.time_field
        before = Q(**{f"{field}__lt": cursor.at})
        if self.source_type < cursor.source_type:
            return before | Q(**{field: cursor.at})
        if self.source_type == cursor.source_type:
            return before | Q(**{field: cursor.at, "pk__lt": cursor.source_id})
        return before


def _author(user: Any) -> dict[str, str] | None:  # noqa: ANN401 -- nullable user relation
    return None if user is None else {"username": user.username}


def _entry(  # noqa: PLR0913 -- one flat projection of a retained fact
    source_type: str,
    row: Any,  # noqa: ANN401
    kind: str,
    at: datetime,
    author: Any,  # noqa: ANN401
    **extra: Any,  # noqa: ANN401
) -> TimelineEntry:
    return TimelineEntry(
        source_type=source_type,
        source_id=str(row.pk),
        occurred_at=at,
        kind=kind,
        author=_author(author),
        reason=extra.get("reason"),
        refs=extra.get("refs", []),
        params=extra.get("params", {}),
    )


def _motorcycle_sources(record: Motorcycle) -> list[RowSource]:
    def block(row: MotorcycleBlockEvent) -> TimelineEntry:
        return _entry(
            "motorcycle_block",
            row,
            f"motorcycle.{row.action}",
            row.created_at,
            row.created_by,
            reason=row.reason or None,
            params={"blocked_reason": row.blocked_reason},
        )

    def void(row: Motorcycle) -> TimelineEntry:
        return _entry(
            "motorcycle_void",
            row,
            "record.void",
            row.voided_at,  # type: ignore[arg-type]
            row.voided_by,
            reason=row.void_reason or None,
            params={"reason_code": row.void_reason_code},
        )

    return [
        RowSource(
            "motorcycle_block",
            MotorcycleBlockEvent.objects.filter(motorcycle=record).select_related("created_by"),
            "created_at",
            block,
        ),
        RowSource(
            "motorcycle_void",
            Motorcycle.objects.filter(pk=record.pk, voided_at__isnull=False).select_related(
                "voided_by"
            ),
            "voided_at",
            void,
        ),
    ]


def _quadrant_sources(record: Any) -> list[RowSource]:  # noqa: ANN401
    def version(row: QuadrantVersion) -> TimelineEntry:
        return _entry(
            "quadrant_version",
            row,
            "quadrant.version",
            row.created_at,
            row.created_by,
            params={"revision": row.revision, "effective_from": row.effective_from.isoformat()},
        )

    rows = QuadrantVersion.objects.filter(quadrant=record).select_related("created_by")
    return [RowSource("quadrant_version", rows, "created_at", version)]


def _point_sources(record: Any) -> list[RowSource]:  # noqa: ANN401
    def version(row: PointVersion) -> TimelineEntry:
        return _entry(
            "point_version",
            row,
            "sampling_point.version",
            row.created_at,
            row.created_by,
            params={"version": row.version, "is_retired": row.is_retired},
        )

    def decision(row: ExcludedPointResolution) -> TimelineEntry:
        return _entry(
            "point_decision",
            row,
            "sampling_point.decision",
            row.created_at,
            row.created_by,
            params={"decision": row.decision},
        )

    return [
        RowSource(
            "point_version",
            PointVersion.objects.filter(point=record).select_related("created_by"),
            "created_at",
            version,
        ),
        RowSource(
            "point_decision",
            ExcludedPointResolution.objects.filter(point=record).select_related("created_by"),
            "created_at",
            decision,
        ),
    ]


def _incident_sources(record: Any) -> list[RowSource]:  # noqa: ANN401
    def event(row: IncidentEvent) -> TimelineEntry:
        return _entry(
            "incident_event",
            row,
            f"incident.{row.action}",
            row.created_at,
            row.created_by,
            reason=row.text or None if row.action in REASON_ACTIONS else None,
            params={"state": row.state, "severity": row.severity, "revision": row.revision},
        )

    def received(row: FieldEvent) -> TimelineEntry:
        return _entry(
            "field_event",
            row,
            "field.received",
            row.server_received_at,
            row.created_by,
            params={
                "event_type": row.type,
                "status": row.status,
                "status_code": row.status_code,
                "device_time": row.device_time.isoformat(),
            },
        )

    def void(row: FieldEvent) -> TimelineEntry:
        return _entry(
            "field_event_void",
            row,
            "record.void",
            row.voided_at,  # type: ignore[arg-type]
            row.voided_by,
            reason=row.void_reason or None,
            params={"reason_code": row.void_reason_code},
        )

    source_events = FieldEvent.objects.filter(pk=record.source_event_id)
    return [
        RowSource(
            "incident_event",
            IncidentEvent.objects.filter(incident=record).select_related("created_by"),
            "created_at",
            event,
        ),
        RowSource(
            "field_event",
            source_events.select_related("created_by"),
            "server_received_at",
            received,
        ),
        RowSource(
            "field_event_void",
            source_events.filter(voided_at__isnull=False).select_related("voided_by"),
            "voided_at",
            void,
        ),
    ]


def _shipment_sources(record: UiebShipment, visible: QuerySet[Any]) -> list[RowSource]:
    previous = (
        visible.filter(pk=record.supersedes_id).values_list("code", flat=True).first()
        if record.supersedes_id
        else None
    )

    def created(row: UiebShipment) -> TimelineEntry:
        refs = [] if previous is None else [{"type": "shipment", "code": previous}]
        return _entry(
            "export_created",
            row,
            "export.created",
            row.created_at,
            row.created_by,
            reason=row.reason or None,
            refs=refs,
            params={"cutoff": row.cutoff.isoformat(), "template_version": row.template_version},
        )

    def revised(row: UiebShipment) -> TimelineEntry:
        return _entry(
            "export_revised",
            row,
            "export.revised",
            row.created_at,
            row.created_by,
            reason=row.reason or None,
            refs=[{"type": "shipment", "code": row.code}],
        )

    def void(row: ShipmentVoid) -> TimelineEntry:
        return _entry(
            "export_void", row, "record.void", row.created_at, row.created_by, reason=row.reason
        )

    return [
        RowSource(
            "export_created",
            UiebShipment.objects.filter(pk=record.pk).select_related("created_by"),
            "created_at",
            created,
        ),
        RowSource(
            "export_revised",
            visible.filter(supersedes=record).select_related("created_by"),
            "created_at",
            revised,
        ),
        RowSource(
            "export_void",
            ShipmentVoid.objects.filter(shipment=record).select_related("created_by"),
            "created_at",
            void,
        ),
    ]


def sources_for(
    record_type: str,
    record: Any,  # noqa: ANN401 -- the resolved, already authorized record
    visible: QuerySet[Any],
) -> list[RowSource]:
    builders: dict[str, Callable[[], list[RowSource]]] = {
        "incident": lambda: _incident_sources(record),
        "motorcycle": lambda: _motorcycle_sources(record),
        "quadrant": lambda: _quadrant_sources(record),
        "sampling_point": lambda: _point_sources(record),
        "shipment": lambda: _shipment_sources(record, visible),
    }
    return builders[record_type]()


def timeline_page(
    sources: list[RowSource], cursor: Cursor | None, limit: int
) -> tuple[list[TimelineEntry], str | None]:
    """Merge the per-source windows; `limit + 1` rows tell whether another page exists."""
    merged = [entry for source in sources for entry in source.page(cursor, limit + 1)]
    merged.sort(
        key=lambda entry: (entry["occurred_at"], entry["source_type"], entry["source_id"]),
        reverse=True,
    )
    page = merged[:limit]
    if len(merged) <= limit:
        return page, None
    last = page[-1]
    return page, Cursor(last["occurred_at"], last["source_type"], UUID(last["source_id"])).encode()
