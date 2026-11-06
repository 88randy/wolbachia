"""Read exact original identity and real legacy materialization; never repair it."""

from dataclasses import dataclass, field
from typing import Any

from field_sync.envelope import EventEnvelope, GpsFix, describe_payload
from field_sync.models import FieldEvent
from reviews.models import ReviewSourceSnapshot
from reviews.source_identity import envelope_from_metadata


def validated_original_payload(source: FieldEvent) -> dict[str, Any]:
    from field_sync.registry import OrgScopedRequest, find_handler

    handler = find_handler(source.type, source.schema_version)
    serializer = handler.payload_serializer(
        data=source.payload,
        context={
            "request": OrgScopedRequest(source.organization),
            "organization": source.organization,
        },
    )
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


@dataclass(frozen=True)
class ExistingEffect:
    state: str = "none"
    materialization: dict[str, Any] = field(default_factory=dict)
    blockers: tuple[str, ...] = ()


def original_source_envelope(source: FieldEvent) -> EventEnvelope:
    snapshot = ReviewSourceSnapshot.objects.filter(source_event=source).first()
    if snapshot is not None:
        return envelope_from_metadata(snapshot.original_envelope, source.payload)
    info = describe_payload(source.payload)
    if info.sha256 != source.payload_sha256 or (
        source.type == "record.void" and source.voids_event_id is None
    ):
        raise ValueError("Original source identity is unavailable.")
    gps = (
        None
        if source.gps_lat is None or source.gps_lng is None
        else GpsFix(source.gps_lat, source.gps_lng, source.gps_accuracy_m)
    )
    return EventEnvelope(
        index=0,
        id=source.pk,
        type=source.type,
        schema_version=source.schema_version,
        device_time=source.device_time,
        payload=source.payload,
        payload_info=info,
        rules_version=source.rules_version,
        catalog_version=source.catalog_version,
        manual_capture=source.manual_capture,
        shift_id=source.shift_id,
        gps=gps,
        voids_event_id=source.voids_event_id,
    )


def inspect_shift(source: FieldEvent, envelope: EventEnvelope) -> ExistingEffect:
    from shifts.models import MotorcycleBlockEvent, Shift

    field_name = "opened_event" if source.type == "shift.open" else "closed_event"
    rows = Shift.objects.filter(**{field_name: source}).select_related("motorcycle")
    shift = rows.first()
    if shift is None:
        if MotorcycleBlockEvent.objects.filter(field_event=source).exists():
            return ExistingEffect("partial", blockers=("legacy_materialization_inconsistent",))
        return ExistingEffect()
    data = validated_original_payload(source)
    valid = (
        shift.pk == envelope.shift_id
        and shift.organization_id == source.organization_id
        and shift.courier_id == source.created_by_id
    )
    if source.type == "shift.close":
        valid &= (
            shift.status == "closed"
            and shift.closed_at_device == source.device_time
            and shift.odometer_close_km == data.get("odometer_km")
            and shift.close_note == data.get("note", "")
        )
    else:
        checks = sorted(
            (line["item"], line["result"], line.get("note", "")) for line in data.get("checks", [])
        )
        real = sorted(shift.checks.values_list("item__code", "result", "note"))
        valid &= (
            shift.device_id == source.device_id
            and shift.motorcycle.code == data.get("motorcycle_code")
            and shift.opened_at_device == source.device_time
            and shift.odometer_open_km == data.get("odometer_km")
            and shift.open_note == data.get("note", "")
            and checks == real
        )
        blocks = MotorcycleBlockEvent.objects.filter(field_event=source)
        severe = any(line[1] == "severe" for line in checks)
        valid &= (
            blocks.filter(
                motorcycle=shift.motorcycle, action="block", blocked_reason="severe_check"
            ).count()
            == 1
            if severe
            else not blocks.exists()
        )
    return ExistingEffect(
        "complete_owned" if valid else "partial",
        {"shift_id": str(shift.pk)},
        () if valid else ("legacy_materialization_inconsistent",),
    )


def inspect_fuel(source: FieldEvent, envelope: EventEnvelope) -> ExistingEffect:
    from fleet.models import FuelLoad

    row = FuelLoad.objects.filter(event=source).select_related("motorcycle").first()
    if row is None:
        return ExistingEffect()
    data = validated_original_payload(source)
    valid = (
        row.organization_id == source.organization_id
        and row.created_by_id == source.created_by_id
        and row.shift_id == source.shift_id
        and row.motorcycle.code == data.get("motorcycle_id")
    )
    for key in (
        "odometer_km",
        "litres",
        "amount",
        "currency",
        "is_full_refill",
        "receipt_upload_id",
    ):
        actual, declared = getattr(row, key), data.get(key)
        valid &= actual == declared
    return ExistingEffect(
        "complete_owned" if valid else "partial",
        {
            "fuel_load_id": str(row.pk),
            "provisional": row.provisional,
            "baseline_id": None if row.baseline_id is None else str(row.baseline_id),
            "rule_provenance": row.rule_provenance,
        },
        () if valid else ("legacy_materialization_inconsistent",),
    )
