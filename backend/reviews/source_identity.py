"""Lossless validated envelope identity, independent of nullable relational links."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from field_sync.envelope import EventEnvelope, GpsFix, describe_payload

SOURCE_POLICY_VERSION = "reviews.v1"
ENVELOPE_METADATA_VERSION = 1


def envelope_metadata(envelope: EventEnvelope) -> dict[str, Any]:
    gps = envelope.gps
    return {
        "version": ENVELOPE_METADATA_VERSION,
        "id": str(envelope.id),
        "type": envelope.type,
        "schema_version": envelope.schema_version,
        "device_time": envelope.device_time.astimezone(UTC).isoformat(),
        "payload_sha256": envelope.payload_info.sha256,
        "rules_version": envelope.rules_version,
        "catalog_version": envelope.catalog_version,
        "manual_capture": envelope.manual_capture,
        "shift_id": str(envelope.shift_id) if envelope.shift_id else None,
        "gps": None
        if gps is None
        else {"lat": gps.lat, "lng": gps.lng, "accuracy_m": gps.accuracy_m},
        "declared_void_target_uuid": str(envelope.voids_event_id)
        if envelope.voids_event_id
        else None,
    }


def envelope_from_metadata(metadata: dict[str, Any], payload: dict[str, Any]) -> EventEnvelope:
    info = describe_payload(payload)
    if metadata.get("version") != ENVELOPE_METADATA_VERSION or info.sha256 != metadata.get(
        "payload_sha256"
    ):
        raise ValueError("Original source identity is unavailable.")
    return EventEnvelope(
        index=0,
        id=UUID(metadata["id"]),
        type=metadata["type"],
        schema_version=metadata["schema_version"],
        device_time=datetime.fromisoformat(metadata["device_time"]),
        payload=payload,
        payload_info=info,
        rules_version=metadata["rules_version"],
        catalog_version=metadata["catalog_version"],
        manual_capture=metadata["manual_capture"],
        shift_id=UUID(metadata["shift_id"]) if metadata.get("shift_id") else None,
        gps=GpsFix(**metadata["gps"]) if metadata.get("gps") is not None else None,
        voids_event_id=UUID(metadata["declared_void_target_uuid"])
        if metadata.get("declared_void_target_uuid")
        else None,
    )


def same_envelope(metadata: dict[str, Any], incoming: EventEnvelope) -> bool:
    """Request position is delivery metadata; the original declared target is identity."""
    return metadata == envelope_metadata(incoming)
