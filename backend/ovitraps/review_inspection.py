"""Exact retained legacy effects; presence alone never proves a complete capture."""

from typing import Any
from uuid import UUID

from django.core.exceptions import ValidationError

from catalogs.models import CatalogSnapshot
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from geography.models import PointVersion
from ovitraps.capture import _usable_rules
from ovitraps.findings import resolve_item
from ovitraps.lifecycle.models import (
    LifecycleRecord,
    PhysicalOvitrapLineage,
    RelocationProposal,
    RemovalAttempt,
)
from ovitraps.models import Bag, Ovitrap, OvitrapReading, PlacementAttempt
from reviews.inspection import ExistingEffect, validated_original_payload
from rules.models import RuleParameterVersion
from rules.selectors import to_number


def inspect_legacy_capture(source: FieldEvent) -> ExistingEffect:
    try:
        data = validated_original_payload(source)
        if source.type == "ovitrap.place":
            return _placement(source, data)
        if source.type == "ovitrap.check":
            return _reading(source, data)
        return _lifecycle(source, data)
    except (EventNeedsReview, EventRejected, ValueError, ValidationError):
        return _result(False, {})


def _owned(row: Any, source: FieldEvent) -> bool:  # noqa: ANN401 -- concrete immutable owner rows share these audit fields
    return row is not None and (row.organization_id, row.created_by_id, row.event_id) == (
        source.organization_id,
        source.created_by_id,
        source.pk,
    )


def _result(valid: bool, identities: dict[str, Any]) -> ExistingEffect:
    return ExistingEffect(
        "complete_owned" if valid else "partial",
        identities if valid else {},
        () if valid else ("legacy_materialization_inconsistent",),
    )


def _capture_valid(  # noqa: PLR0913 -- original owner row, exact selected geometry and immutable source
    row: PlacementAttempt | OvitrapReading | LifecycleRecord,
    version: PointVersion,
    source: FieldEvent,
) -> bool:
    _usable_rules(row.evaluated_rules)
    if (
        version.organization_id != source.organization_id
        or version.is_retired
        or version.effective_from > source.device_time
        or version.created_at > row.created_at
    ):
        return False
    identifiers = row.rule_version_ids
    versions = {
        str(value.pk): value
        for value in RuleParameterVersion.objects.filter(
            organization=source.organization, pk__in=[UUID(value) for value in identifiers.values()]
        ).select_related("parameter")
    }
    for key, value in row.evaluated_rules.items():
        if value is None:
            continue
        selected = versions.get(identifiers.get(key))
        if (
            type(value) not in {int, float}
            or selected is None
            or selected.parameter.key != key
            or selected.parameter.organization_id != source.organization_id
            or selected.created_at > row.created_at
            or selected.effective_from > source.device_time
            or (selected.voided_at is not None and selected.voided_at <= row.created_at)
            or to_number(selected.parameter.value_type, selected.value) != value
        ):
            return False
    return True


def _placement(source: FieldEvent, data: dict[str, Any]) -> ExistingEffect:
    physical = Ovitrap.objects.filter(event=source).select_related("point_version").first()
    row = PlacementAttempt.objects.filter(event=source).first()
    if physical is None and row is None:
        return ExistingEffect()
    valid = (
        _owned(physical, source)
        and _owned(row, source)
        and physical is not None
        and row is not None
        and physical.client_uuid == data["ovitrap_id"]
        and physical.sampling_point_id == data["sampling_point_id"]
        and physical.point_version.point_id == physical.sampling_point_id
        and row.ovitrap_id == physical.pk
        and row.supply_refs == data["supply_refs"]
        and row.evidence_ids == data["evidence_ids"]
        and _capture_valid(row, physical.point_version, source)
    )
    return _result(
        valid,
        {}
        if physical is None or row is None
        else {
            "ovitrap_id": str(physical.pk),
            "placement_id": str(row.pk),
            "point_version_id": str(physical.point_version_id),
            "rule_version_ids": row.rule_version_ids,
        },
    )


def _choice(source: FieldEvent, slug: str, code: str) -> tuple[UUID, dict[str, str]]:
    snapshot = CatalogSnapshot.objects.filter(
        organization=source.organization, version=source.catalog_version
    ).first()
    if snapshot is None:
        raise ValueError("Original catalog is unavailable.")
    choice = resolve_item(snapshot, slug, code)
    return choice.item.pk, {
        "es-MX": choice.historical["label_es"],
        "en": choice.historical["label_en"],
    }


def _reading(source: FieldEvent, data: dict[str, Any]) -> ExistingEffect:
    row = (
        OvitrapReading.objects.filter(event=source)
        .select_related("ovitrap", "point_version")
        .first()
    )
    bag = Bag.objects.filter(event=source).first()
    if row is None:
        return ExistingEffect() if bag is None else _result(False, {})
    finding_id, finding_label = _choice(source, "ovitrap-finding", data["finding"])
    paddle_id = (
        None
        if data["paddle_type"] is None
        else _choice(source, "paddle-type", data["paddle_type"])[0]
    )
    declared = (
        "other_text",
        "paddle_present",
        "has_eggs",
        "temperature_c",
        "humidity_pct",
        "is_lagged",
    )
    valid = (
        _owned(row, source)
        and row.ovitrap.organization_id == source.organization_id
        and row.ovitrap.client_uuid == data["ovitrap_id"]
        and row.point_version.point_id == row.ovitrap.sampling_point_id
        and row.finding_id == finding_id
        and row.finding_code == data["finding"]
        and row.finding_label == finding_label
        and row.paddle_type_id == paddle_id
        and all(getattr(row, key) == data[key] for key in declared)
        and row.is_index_excluded == data["is_lagged"]
        and row.index_exclusion_reason == ("lagged" if data["is_lagged"] else "")
        and _capture_valid(row, row.point_version, source)
        and _bag_valid(bag, row, data, source)
    )
    return _result(
        valid,
        {
            "reading_id": str(row.pk),
            "bag_id": None if bag is None else str(bag.pk),
            "point_version_id": str(row.point_version_id),
            "rule_version_ids": row.rule_version_ids,
        },
    )


def _bag_valid(  # noqa: PLR0913 -- actual bag, reading, original values and source
    bag: Bag | None,
    row: OvitrapReading,
    data: dict[str, Any],
    source: FieldEvent,
) -> bool:
    if data["bag_code"] is None:
        return bag is None
    return (
        _owned(bag, source)
        and bag is not None
        and bag.reading_id == row.pk
        and bag.collector_id == source.created_by_id
        and bag.code == data["bag_code"]
        and bag.field_flags
        == {
            "has_eggs": row.has_eggs,
            "is_lagged": row.is_lagged,
            "is_index_excluded": row.is_index_excluded,
        }
    )


def _lifecycle(source: FieldEvent, data: dict[str, Any]) -> ExistingEffect:
    kind = source.type.removeprefix("ovitrap.")
    model = {
        "replace": PhysicalOvitrapLineage,
        "relocate": RelocationProposal,
        "remove": RemovalAttempt,
    }[kind]
    row = model.objects.filter(event=source).select_related("point_version").first()
    if row is None:
        # A replacement identity without its lineage is incomplete, not no-effect.
        return (
            _result(False, {})
            if kind == "replace" and Ovitrap.objects.filter(event=source).exists()
            else ExistingEffect()
        )
    original = row.old_trap if isinstance(row, PhysicalOvitrapLineage) else row.ovitrap
    reason_id, reason_label = _choice(
        source,
        f"{ {'replace': 'replacement', 'relocate': 'relocation', 'remove': 'removal'}[kind] }-reason",
        data["reason_code"],
    )
    valid = (
        _owned(row, source)
        and original.organization_id == source.organization_id
        and original.client_uuid == data["ovitrap_id"]
        and row.point_version.point_id == original.sampling_point_id
        and row.reason_id == reason_id
        and row.reason_code == data["reason_code"]
        and row.reason_label == reason_label
        and row.other_text == data["other_text"]
        and row.evidence_ids == data["evidence_ids"]
        and _capture_valid(row, row.point_version, source)
        and _lifecycle_values(row, data, source)
    )
    return _result(
        valid,
        {
            f"{kind}_id": str(row.pk),
            "point_version_id": str(row.point_version_id),
            "rule_version_ids": row.rule_version_ids,
        },
    )


def _lifecycle_values(
    row: PhysicalOvitrapLineage | RelocationProposal | RemovalAttempt,
    data: dict[str, Any],
    source: FieldEvent,
) -> bool:
    if isinstance(row, PhysicalOvitrapLineage):
        return (
            _owned(row.new_trap, source)
            and row.new_trap.client_uuid == data["replacement_id"]
            and row.new_trap.sampling_point_id == row.old_trap.sampling_point_id
            and row.new_trap.point_version_id == row.point_version_id
            and row.point_id == row.old_trap.sampling_point_id
        )
    if isinstance(row, RelocationProposal):
        return (
            row.new_location == data["proposed_location"]
            and row.old_location == row.point_version.location
        )
    return (
        row.is_recovered is data["is_recovered"]
        and row.recovery_state == ("recovered" if data["is_recovered"] else "unrecovered")
        and (
            row.incident_link is None
            if data["is_recovered"] and row.incident_link_id is None
            else row.incident_link is not None
            and row.incident_link.organization_id == source.organization_id
            and row.incident_link.ovitrap_id == row.ovitrap_id
        )
    )
