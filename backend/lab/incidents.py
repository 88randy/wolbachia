"""Public CAS policy and bounded pending-configuration recovery use the real incident owner."""

from typing import Any, cast

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from incidents.exceptions import IncidentConfigurationUnavailableError
from incidents.lab_sources import create_reception_incident, reception_type
from incidents.models import IncidentTypeVersion
from incidents.permissions import INCIDENT_MANAGE_TYPE
from lab.exceptions import LabConflictError, LabInProgressError
from lab.models import ReceptionDiscrepancy, ReceptionIncidentLink, ReceptionIncidentPolicyVersion
from lab.transactions import lab_system_transaction, lab_transaction, require_lab_lock
from uploads.access import UploadActor, current_scope


def write_reception_policy(
    actor: UploadActor, values: dict[str, Any]
) -> ReceptionIncidentPolicyVersion:
    with lab_transaction(actor):
        if not current_scope(actor).allows(INCIDENT_MANAGE_TYPE):
            raise PermissionDenied
        previous = ReceptionIncidentPolicyVersion.objects.filter(
            organization=actor.organization
        ).first()
        revision = 0 if previous is None else previous.revision
        if values["expected_revision"] != revision:
            raise LabConflictError("lab_state_conflict", revision)
        identifiers = (values["missing_type_version"], values["no_reading_type_version"])
        if IncidentTypeVersion.objects.filter(
            organization=actor.organization, pk__in=set(identifiers)
        ).count() != len(set(identifiers)):
            raise Http404
        try:
            for identifier in identifiers:
                reception_type(actor.organization, identifier)
        except IncidentConfigurationUnavailableError as error:
            raise LabConflictError("lab_configuration_unavailable") from error
        return ReceptionIncidentPolicyVersion.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            revision=revision + 1,
            missing_type_version_id=identifiers[0],
            no_reading_type_version_id=identifiers[1],
        )


def link_reception_incident(discrepancy: ReceptionDiscrepancy) -> ReceptionIncidentLink | None:
    require_lab_lock(discrepancy.organization_id)
    existing = ReceptionIncidentLink.objects.filter(discrepancy=discrepancy).first()
    if existing is not None:
        return cast(ReceptionIncidentLink, existing)
    policy = ReceptionIncidentPolicyVersion.objects.filter(
        organization=discrepancy.organization
    ).first()
    if policy is None:
        return None
    identifier = (
        policy.missing_type_version_id
        if discrepancy.kind == "missing"
        else policy.no_reading_type_version_id
    )
    try:
        incident = create_reception_incident(discrepancy, identifier)
    except IncidentConfigurationUnavailableError:
        return None
    return ReceptionIncidentLink.objects.create(
        organization=discrepancy.organization,
        created_by=None,
        actor_kind="system",
        policy_version="lab.reception.v1",
        discrepancy=discrepancy,
        incident=incident,
        policy=policy,
    )


def recover_reception_incident(discrepancy: ReceptionDiscrepancy) -> bool:
    """Prepare the authentic source recipient before entering the system lock order."""
    from lab.access import LabTarget, PreparedLabSubject, subject_authors
    from lab.history import publish_lab_fact
    from lab.permissions import BAG_RECEIVE

    reading = discrepancy.bag.reading
    if reading.event.created_by_id is None or discrepancy.created_by_id is None:
        return False
    quadrant = reading.ovitrap.sampling_point.block.quadrant
    prepared = PreparedLabSubject(
        reading.pk,
        reading.event_id,
        reading.event.created_by_id,
        discrepancy.bag_id,
        quadrant.center_id,
        quadrant.pk,
        subject_authors(discrepancy.bag, (LabTarget("bag", discrepancy.bag_id), BAG_RECEIVE)),
    )
    with lab_system_transaction(discrepancy.organization, (prepared,)):
        current = ReceptionDiscrepancy.objects.select_for_update(nowait=True, no_key=True).get(
            pk=discrepancy.pk
        )
        if (
            current.created_by_id not in prepared.author_ids
            or current.source_id != prepared.source_id
            or current.bag_id != prepared.bag_id
            or subject_authors(current.bag, (LabTarget("bag", current.bag_id), BAG_RECEIVE))
            != prepared.author_ids
        ):
            raise LabInProgressError
        if ReceptionIncidentLink.objects.filter(discrepancy=current).exists():
            return False
        link = link_reception_incident(current)
        if link is not None:
            publish_lab_fact(current)
        return link is not None


def policy_availability(policy: ReceptionIncidentPolicyVersion | None) -> str:
    if policy is None:
        return "unconfigured"
    try:
        for identifier in (policy.missing_type_version_id, policy.no_reading_type_version_id):
            reception_type(policy.organization, identifier)
    except IncidentConfigurationUnavailableError:
        return "unavailable"
    return "configured"
