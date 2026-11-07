"""One explicit automatic origin for a persisted authorized lab reception discrepancy."""

from typing import cast
from uuid import UUID

from django.db.models import Max

from core.snapshots import snapshot_hash
from incidents.configuration import chain, eligible_owner
from incidents.exceptions import IncidentConfigurationUnavailableError
from incidents.models import AutomaticIncidentOrigin, Incident, IncidentTypeVersion
from incidents.policy import next_stage
from incidents.selectors import ResourceContext, latest_types
from incidents.services import _deadline, append_event
from lab.models import ReceptionDiscrepancy
from lab.transactions import require_lab_lock
from organizations.models import Organization


def reception_type(organization: Organization, identifier: UUID) -> IncidentTypeVersion:
    version = (
        latest_types(organization)
        .filter(pk=identifier, is_active=True, item__is_active=True)
        .first()
    )
    if (
        version is None
        or version.report_evidence_min != 0
        or version.blocker_kinds != []
        or eligible_owner(version.terminal_id, organization, None, terminal=True) is None
    ):
        raise IncidentConfigurationUnavailableError
    return cast(IncidentTypeVersion, version)


def create_reception_incident(discrepancy: ReceptionDiscrepancy, type_id: UUID) -> Incident:
    """Caller holds Lab's Organization arbiter; no surrogate FieldEvent or guessed owner."""
    require_lab_lock(discrepancy.organization_id)
    origin = (
        AutomaticIncidentOrigin.objects.filter(
            organization=discrepancy.organization,
            source_kind="lab_reception",
            source_id=discrepancy.pk,
        )
        .select_related("incident")
        .first()
    )
    if origin is not None:
        return origin.incident
    version = reception_type(discrepancy.organization, type_id)
    quadrant = discrepancy.bag.reading.ovitrap.sampling_point.block.quadrant
    context = ResourceContext(quadrant.center_id, quadrant.pk)
    owners = chain(version, context)
    stage = next_stage(-1, tuple(owner is not None for owner in owners))
    sequence = (
        Incident.objects.filter(organization=discrepancy.organization).aggregate(
            highest=Max("sequence")
        )["highest"]
        or 0
    ) + 1
    incident = Incident.objects.create(
        organization=discrepancy.organization,
        created_by=None,
        sequence=sequence,
        code=f"I-{sequence:06d}",
        type_version=version,
        center_id=context.center_id,
        quadrant_id=context.quadrant_id,
        device_time=discrepancy.created_at,
        server_received_at=discrepancy.created_at,
        description=discrepancy.reason or discrepancy.kind,
    )
    AutomaticIncidentOrigin.objects.create(
        organization=discrepancy.organization,
        created_by=None,
        actor_kind="system",
        policy_version="lab.reception.v1",
        incident=incident,
        source_kind="lab_reception",
        source_id=discrepancy.pk,
        content_hash=snapshot_hash(discrepancy.source_proof),
    )
    append_event(
        incident,
        {
            "revision": 1,
            "action": "report",
            "state": "open",
            "owner": owners[stage],
            "stage": stage,
            "severity": version.severity,
            "stage_entered_at": discrepancy.created_at,
            "deadline": _deadline(version, stage, discrepancy.created_at),
            "last_reminder_at": discrepancy.created_at,
            "evidence_ids": [],
        },
        None,
    )
    return incident
