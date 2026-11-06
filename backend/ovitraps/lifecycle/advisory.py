"""Fresh current read authority; no original capture proof or business effect is changed."""

from datetime import datetime
from typing import Any, Literal, cast
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import DatabaseError, transaction
from rest_framework.exceptions import NotFound, PermissionDenied

from core.snapshots import snapshot_hash, with_version
from core.time import format_instant, server_now
from field_sync.exceptions import SyncInProgressError
from field_sync.permissions import FIELD_BOOTSTRAP, FIELD_EVENT_SYNC
from field_sync.services import RETRYABLE_SQLSTATES, set_batch_lock_timeout
from organizations.models import Organization
from ovitraps.lifecycle.advisory_selectors import AdvisoryObservation, select_advisory_observation
from ovitraps.models import Ovitrap
from uploads.access import UploadActor, current_scope, lock_actor

ADVISORY_ACTIONS = (FIELD_BOOTSTRAP, FIELD_EVENT_SYNC)
ADVISORY_SCHEMA_VERSION = 1
UnavailableReason = Literal[
    "future_cutoff", "rule_context_unavailable", "organization_context_unavailable"
]
RESULT_FIELDS = (
    "rule_context",
    "rule_context_version",
    "required_epi_weeks",
    "observed_closed_house_weeks",
    "incident_count",
    "suggested",
)


def scoped_ovitrap(actor: UploadActor, physical_uuid: UUID) -> Ovitrap:
    scope = current_scope(actor)
    if not all(scope.allows(action) for action in ADVISORY_ACTIONS):
        raise PermissionDenied
    ovitrap = (
        Ovitrap.objects.select_related("organization", "sampling_point__block__quadrant")
        .filter(
            organization=actor.organization,
            client_uuid=physical_uuid,
            sampling_point__organization=actor.organization,
            sampling_point__block__organization=actor.organization,
            sampling_point__block__quadrant__organization=actor.organization,
        )
        .first()
    )
    if ovitrap is None:
        raise NotFound
    quadrant = ovitrap.sampling_point.block.quadrant
    if not all(
        scope.allows(action, str(quadrant.center_id), str(quadrant.pk))
        for action in ADVISORY_ACTIONS
    ):
        raise NotFound
    return cast(Ovitrap, ovitrap)


def unavailable_context(organization: Organization, at: datetime) -> UnavailableReason | None:
    if at > server_now():
        return "future_cutoff"
    if organization.epi_week not in {"iso", "mmwr"}:
        return "organization_context_unavailable"
    try:
        ZoneInfo(organization.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return "organization_context_unavailable"
    return None


def build_advisory_snapshot(
    ovitrap: Ovitrap, at: datetime, observation: AdvisoryObservation | UnavailableReason
) -> dict[str, Any]:
    """Hash computed state/content, excluding request time and mutable session metadata."""
    available = isinstance(observation, AdvisoryObservation)
    content: dict[str, Any] = {
        "schema_version": ADVISORY_SCHEMA_VERSION,
        "physical_ovitrap_id": str(ovitrap.client_uuid),
        "point_id": str(ovitrap.sampling_point_id),
        "as_of": format_instant(at),
        "state": "available" if available else "unavailable",
        "unavailable_reason": None if available else observation,
        **dict.fromkeys(RESULT_FIELDS),
    }
    if isinstance(observation, AdvisoryObservation):
        content.update(
            rule_context=observation.rules.context,
            rule_context_version=snapshot_hash(observation.rules.context),
            required_epi_weeks=list(observation.required_epi_weeks),
            observed_closed_house_weeks=list(observation.observed_closed_house_weeks),
            incident_count=observation.incident_count,
            suggested=observation.suggested,
        )
    return with_version(content)


def read_scoped_advisory(actor: UploadActor, physical_uuid: UUID, at: datetime) -> dict[str, Any]:
    """Account NOWAIT -> Organization NOWAIT -> fresh paired scope/facts in ONE transaction."""
    if actor.session_id is None or actor.device_id is None or actor.pair_id is None:
        raise PermissionDenied
    scoped_ovitrap(actor, physical_uuid)
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            lock_actor(actor)
            Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=actor.organization.pk
            )
            ovitrap = scoped_ovitrap(actor, physical_uuid)
            reason = unavailable_context(ovitrap.organization, at)
            observation = reason or select_advisory_observation(ovitrap, at)
            return build_advisory_snapshot(ovitrap, at, observation or "rule_context_unavailable")
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from error
        raise
