"""Derived physical state, advisory relocation thresholds and chronological provenance."""

from datetime import datetime, timedelta
from math import isfinite
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db.models import Exists, OuterRef, Q, QuerySet, Subquery, TextField, Value
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Coalesce, Lower, Replace
from django.utils import timezone
from rest_framework.exceptions import NotFound

from core.time import epi_week_label
from field_sync.models import FieldEvent
from geography.models import SamplingPoint
from organizations.models import Membership, Organization
from organizations.selectors import filter_by_effective_scope
from ovitraps.lifecycle.models import (
    OvitrapIncidentLink,
    PhysicalOvitrapLineage,
    RelocationDecision,
    RelocationProposal,
    RemovalAttempt,
    RemovalResolution,
)
from ovitraps.models import Ovitrap, OvitrapReading
from ovitraps.permissions import OVITRAP_REMOVAL_RESOLVE
from rules.seeds import DEFAULT_PARAMETER_SEEDS
from rules.selectors import get_values_in_force

THRESHOLD_KEYS = ("closed_house_weeks_to_relocate", "incidents_to_relocate")


def retirement_rows(
    organization: Organization,
) -> tuple[QuerySet[PhysicalOvitrapLineage], QuerySet[RemovalAttempt]]:
    # Exclusion also sees pending operational rows whose deferred source event is not inserted yet.
    voided = FieldEvent.objects.filter(organization=organization, voided_at__isnull=False).values(
        "pk"
    )
    return (
        PhysicalOvitrapLineage.objects.filter(organization=organization).exclude(
            event_id__in=voided
        ),
        RemovalAttempt.objects.filter(organization=organization).exclude(event_id__in=voided),
    )


def with_retirement(queryset: QuerySet[Ovitrap], organization: Organization) -> QuerySet[Ovitrap]:
    lineage, removals = retirement_rows(organization)
    annotations = {
        "is_replaced": Exists(lineage.filter(old_trap=OuterRef("pk"))),
        "is_removed": Exists(removals.filter(ovitrap=OuterRef("pk"))),
        "replacement_event_id": Subquery(
            lineage.filter(old_trap=OuterRef("pk"))
            .order_by("-created_at", "-pk")
            .values("event_id")[:1]
        ),
        "removal_event_id": Subquery(
            removals.filter(ovitrap=OuterRef("pk"))
            .order_by("-created_at", "-pk")
            .values("event_id")[:1]
        ),
    }
    return cast("QuerySet[Ovitrap]", queryset.annotate(**annotations))


def active_ovitraps(organization: Organization) -> QuerySet[Ovitrap]:
    return with_retirement(Ovitrap.objects.filter(organization=organization), organization).filter(  # type: ignore[misc]
        event__voided_at__isnull=True, is_replaced=False, is_removed=False
    )


def is_active(ovitrap: Ovitrap) -> bool:
    return active_ovitraps(ovitrap.organization).filter(pk=ovitrap.pk).exists()


def has_unresolved_removal(
    organization: Organization, quadrant_id: UUID | None = None, *, point: UUID | None = None
) -> bool:
    """Future closure boundary: only live, unrecovered and unresolved removals block."""
    _, rows = retirement_rows(organization)
    rows = rows.filter(is_recovered=False, resolution__isnull=True)
    if quadrant_id is not None:
        rows = rows.filter(ovitrap__sampling_point__block__quadrant_id=quadrant_id)
    if point is not None:
        rows = rows.filter(ovitrap__sampling_point_id=point)
    return rows.exists()


def scoped_removal(member: Membership, identifier: UUID) -> RemovalAttempt:
    """Authorize before any source/domain lock; refresh membership on every call."""
    current = (
        Membership.objects.select_related("user", "organization")
        .filter(
            pk=member.pk,
            organization_id=member.organization_id,
            is_active=True,
            user__is_active=True,
            organization__is_active=True,
        )
        .first()
    )
    if current is None:
        raise NotFound
    rows = RemovalAttempt.objects.filter(organization=current.organization).select_related(
        "event", "ovitrap__sampling_point__block__quadrant"
    )
    removal = (
        filter_by_effective_scope(rows, current, OVITRAP_REMOVAL_RESOLVE)
        .filter(pk=identifier)
        .first()
    )
    if removal is None:
        raise NotFound
    return cast(RemovalAttempt, removal)


def relocation_thresholds(values: dict[str, int | float | None]) -> tuple[int, int] | None:
    definitions = {seed.key: seed for seed in DEFAULT_PARAMETER_SEEDS}
    resolved = []
    for key in THRESHOLD_KEYS:
        value, definition = values.get(key), definitions[key]
        if (
            value is None
            or isinstance(value, bool)
            or not isfinite(value)
            or value != int(value)
            or value < definition.min_value
            or (definition.max_value is not None and value > definition.max_value)
        ):
            return None
        resolved.append(int(value))
    return resolved[0], resolved[1]


def suggest_relocation(ovitrap: Ovitrap, at: datetime | None = None) -> bool:
    instant = at or timezone.now()
    thresholds = relocation_thresholds(get_values_in_force(ovitrap.organization, instant))
    if thresholds is None:
        return False
    weeks, incidents = thresholds
    local_date = instant.astimezone(ZoneInfo(ovitrap.organization.timezone)).date()
    labels = [
        epi_week_label(local_date - timedelta(weeks=offset), ovitrap.organization.epi_week)
        for offset in range(weeks)
    ]
    readings = OvitrapReading.objects.filter(
        organization=ovitrap.organization,
        ovitrap__sampling_point_id=ovitrap.sampling_point_id,
        finding_code="closed-house",
        epi_week__in=labels,
        event__device_time__lte=instant,
        event__voided_at__isnull=True,
    )
    if readings.values("epi_week").distinct().count() >= weeks:
        return True
    return (
        OvitrapIncidentLink.objects.filter(
            organization=ovitrap.organization,
            ovitrap__sampling_point_id=ovitrap.sampling_point_id,
            event__device_time__lte=instant,
            event__voided_at__isnull=True,
        ).count()
        >= incidents
    )


def relocation_proposals(organization: Organization) -> QuerySet[RelocationProposal]:
    latest = RelocationDecision.objects.filter(
        organization=organization, proposal=OuterRef("pk"), event__voided_at__isnull=True
    ).order_by("-event__device_time", "-created_at", "-pk")
    return cast(
        "QuerySet[RelocationProposal]",
        RelocationProposal.objects.filter(organization=organization)
        .select_related("event", "ovitrap__sampling_point")
        .annotate(
            decision_status=Coalesce(Subquery(latest.values("decision")[:1]), Value("pending"))
        ),
    )


def filter_relocations(
    queryset: QuerySet[RelocationProposal], query: dict[str, Any], membership: Membership
) -> QuerySet[RelocationProposal]:
    from ovitraps.permissions import RELOCATION_READ

    for key, model, lookup in (
        ("point", SamplingPoint, "ovitrap__sampling_point_id"),
        ("ovitrap", Ovitrap, "ovitrap__client_uuid"),
    ):
        if identifier := query.get(key):
            visible = filter_by_effective_scope(
                model.objects.filter(organization=membership.organization),
                membership,
                RELOCATION_READ,
            )
            if not visible.filter(
                **{("client_uuid" if key == "ovitrap" else "pk"): identifier}
            ).exists():
                raise NotFound
            queryset = queryset.filter(**{lookup: identifier})
    if not query.get("include_voided", False):
        queryset = queryset.filter(event__voided_at__isnull=True)
    if code := query.get("code"):
        queryset = queryset.filter(pk=code)
    if status := query.get("status"):
        queryset = queryset.filter(decision_status=status)  # type: ignore[misc]
    return queryset


def _payload_uuid(key: str) -> Replace:
    """Match UUIDField spellings without changing the archived original envelope."""
    normalized: Any = Lower(KeyTextTransform(key, "payload"))
    for token in ("urn:uuid:", "-", "{", "}"):
        normalized = Replace(
            normalized, Value(token, TextField()), Value("", TextField()), output_field=TextField()
        )
    return cast(Replace, normalized)


def ovitrap_history(ovitrap: Ovitrap) -> dict[str, Any]:
    """Include source envelopes even when review created no operational effect."""
    identities = Ovitrap.objects.filter(
        organization=ovitrap.organization, sampling_point_id=ovitrap.sampling_point_id
    )
    physical_ids = [value.hex for value in identities.values_list("client_uuid", flat=True)]
    events = (
        FieldEvent.objects.filter(organization=ovitrap.organization)
        .annotate(
            payload_point=_payload_uuid("sampling_point_id"),
            payload_trap=_payload_uuid("ovitrap_id"),
        )
        .filter(
            Q(type="ovitrap.place", payload_point=ovitrap.sampling_point_id.hex)
            | Q(
                type__in=["ovitrap.replace", "ovitrap.relocate", "ovitrap.remove"],
                payload_trap__in=physical_ids,
            )
        )
    )
    source_ids = list(events.values_list("pk", flat=True))
    events = (
        FieldEvent.objects.filter(organization=ovitrap.organization)
        .filter(Q(pk__in=source_ids) | Q(type="record.void", voids_event_id__in=source_ids))
        .order_by("device_time", "server_received_at", "id")
    )
    effects = _history_effects(ovitrap)
    return {
        "ovitrap": ovitrap.client_uuid,
        "point_code": ovitrap.sampling_point.code,
        "suggest_relocation": suggest_relocation(ovitrap),
        "entries": [
            _history_entry(event, ovitrap.sampling_point.code, effects) for event in events
        ],
    }


def _history_effects(ovitrap: Ovitrap) -> dict[UUID, dict[str, Any]]:
    effects: dict[UUID, dict[str, Any]] = {}
    common = {"organization": ovitrap.organization}
    for row in PhysicalOvitrapLineage.objects.filter(
        **common, point_id=ovitrap.sampling_point_id
    ).select_related("old_trap", "new_trap"):
        effects[row.event_id] = {
            "lineage_id": str(row.pk),
            "old_trap": str(row.old_trap.client_uuid),
            "new_trap": str(row.new_trap.client_uuid),
            "evidence_ids": row.evidence_ids,
            "rule_version_ids": row.rule_version_ids,
            "evaluated_rules": row.evaluated_rules,
            "reason_label": row.reason_label,
        }
    for row in RemovalAttempt.objects.select_related("resolution").filter(
        **common, ovitrap__sampling_point_id=ovitrap.sampling_point_id
    ):
        effects[row.event_id] = {
            "removal_id": str(row.pk),
            "recovery_state": row.recovery_state,
            "incident_link": None if row.incident_link_id is None else str(row.incident_link_id),
            "rule_version_ids": row.rule_version_ids,
            "evaluated_rules": row.evaluated_rules,
            "reason_label": row.reason_label,
            "resolution": _resolution_history(getattr(row, "resolution", None)),
        }
    for row in relocation_proposals(ovitrap.organization).filter(
        ovitrap__sampling_point_id=ovitrap.sampling_point_id
    ):
        effects[row.event_id] = {
            "proposal_id": str(row.pk),
            "status": row.decision_status,
            "old_location": row.old_location,
            "new_location": row.new_location,
            "rule_version_ids": row.rule_version_ids,
            "evaluated_rules": row.evaluated_rules,
            "reason_label": row.reason_label,
        }
    return effects


def _resolution_history(resolution: RemovalResolution | None) -> dict[str, Any] | None:
    if resolution is None:
        return None
    return {
        "id": str(resolution.pk),
        "outcome": resolution.outcome,
        "reason": resolution.reason,
        "created_by": str(resolution.created_by_id),
        "created_at": resolution.created_at.isoformat(),
    }


def _history_entry(
    event: FieldEvent, point_code: str, effects: dict[UUID, dict[str, Any]]
) -> dict[str, Any]:
    return {
        "event_id": event.pk,
        "type": event.type,
        "device_time": event.device_time,
        "server_received_at": event.server_received_at,
        "point_code": point_code,
        "author": event.created_by_id,
        "voided_at": event.voided_at,
        "void_reason": event.void_reason,
        "void_reason_code": event.void_reason_code,
        "void_event_id": getattr(getattr(event, "ovitrap_void", None), "event_id", None),
        "ingest_status": event.status,
        "rules_version": event.rules_version,
        "catalog_version": event.catalog_version,
        "gps": None
        if event.gps_lat is None
        else {"lat": event.gps_lat, "lng": event.gps_lng, "accuracy_m": event.gps_accuracy_m},
        "payload": event.payload,
        "effects": effects.get(event.pk, {}),
    }
