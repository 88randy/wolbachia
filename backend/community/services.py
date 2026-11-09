"""One append-only aggregate writer; retries authorize first and reuse immutable receipts."""

from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.http import Http404

from catalogs.models import CatalogItem
from community.exceptions import CommunityConflictError
from community.models import (
    CommunityActivity,
    CommunityActivityEvent,
    CommunityCommandReceipt,
    ComplaintIncidentLink,
)
from community.permissions import authorized_block, require_pair
from community.policy import (
    CATALOG_SLUG,
    CREATE,
    READ,
    VOID,
    command_hash,
    json_value,
    normalize_void_reason,
    validate_words,
)
from community.transactions import community_transaction
from core.time import server_now
from core.void_reason import resolve_void_reason
from field_sync.models import FieldEvent
from geography.models import Block, BlockVersion
from incidents.models import Incident
from organizations.models import Organization
from organizations.scope import EffectiveScope
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class ActivityCommand:
    actor: UploadActor
    command_id: UUID
    values: dict[str, Any]
    origin: str = "http"
    source_identity: dict[str, Any] = field(default_factory=dict)
    source_hash: str = ""
    device_time: datetime | None = None
    server_received_at: datetime | None = None
    original_facts: dict[str, Any] | None = None
    scope: EffectiveScope | None = None


def visible_activity(
    actor: UploadActor, identifier: UUID, permission: str = READ
) -> CommunityActivity:
    activity = (
        CommunityActivity.objects.filter(organization=actor.organization, pk=identifier)
        .select_related("zone__quadrant")
        .first()
    )
    if activity is None:
        raise Http404
    require_pair(current_scope(actor), permission, activity.zone)
    return cast(CommunityActivity, activity)


def create_activity(command: ActivityCommand) -> dict[str, Any]:
    authorized_block(command.actor, command.values["zone_id"], CREATE)
    with community_transaction(command.actor) as organization:
        block = authorized_block(command.actor, command.values["zone_id"], CREATE)
        if replay := _replay(command, "create", command.command_id):
            return replay
        facts = capture_web_facts(command, organization, block)
        return create_activity_locked(command, facts)


def capture_web_facts(
    command: ActivityCommand, organization: Organization, block: Block
) -> dict[str, Any]:
    item = CatalogItem.objects.filter(
        organization=organization,
        catalog__organization=organization,
        catalog__slug=CATALOG_SLUG,
        pk=command.values["type_id"],
        is_active=True,
    ).first()
    if item is None:
        raise Http404
    if item.requires_photo:
        raise CommunityConflictError("community_configuration_unavailable")
    now = server_now()
    version = (
        BlockVersion.objects.filter(organization=organization, block=block, effective_from__lte=now)
        .order_by("-effective_from", "-revision")
        .first()
    )
    if version is None:
        raise CommunityConflictError("community_zone_unavailable")
    snapshot = {
        key: getattr(item, key)
        for key in ("code", "label_es", "label_en", "is_other", "requires_photo")
    }
    return {
        "version": 1,
        "zone_version_id": str(version.pk),
        "type_id": str(item.pk),
        "type_snapshot": snapshot,
        "activity_date": now.astimezone(ZoneInfo(organization.timezone)).date().isoformat(),
        "timezone": organization.timezone,
        "received_at": now.isoformat(),
    }


def _body_hash(command: ActivityCommand, operation: str, target: UUID) -> str:
    return command_hash(
        command.actor.user.pk,
        operation,
        {
            "target": target,
            "origin": command.origin,
            "body": command.values,
            "source_identity": command.source_identity,
        },
    )


def _replay(command: ActivityCommand, operation: str, target: UUID) -> dict[str, Any] | None:
    existing = CommunityCommandReceipt.objects.filter(
        organization=command.actor.organization, command_id=command.command_id
    ).first()
    if existing is None:
        return None
    if (
        existing.created_by_id != command.actor.user.pk
        or existing.operation != operation
        or existing.target_id != target
        or existing.origin != command.origin
        or existing.body_hash != _body_hash(command, operation, target)
    ):
        raise CommunityConflictError("community_command_conflict")
    return dict(existing.response)


def _link_incident(command: ActivityCommand, activity: CommunityActivity) -> None:
    identifier = command.values.get("incident_id")
    if identifier is None:
        return
    incident = Incident.objects.filter(
        organization=command.actor.organization,
        pk=identifier,
        center_id=activity.center_id,
        quadrant_id=activity.quadrant_id,
    ).first()
    scope = command.scope or current_scope(command.actor)
    if incident is None or not scope.allows(
        "incident.read", str(incident.center_id), str(incident.quadrant_id)
    ):
        raise Http404
    ComplaintIncidentLink.objects.create(
        organization=activity.organization,
        created_by=command.actor.user,
        activity=activity,
        incident=incident,
        reason=command.values["agreements"],
    )


def create_activity_locked(command: ActivityCommand, facts: dict[str, Any]) -> dict[str, Any]:
    """Caller retains Organization and all account/courier locks; source need not exist yet."""
    if replay := _replay(command, "create", command.command_id):
        return replay
    if CommunityActivity.objects.filter(pk=command.command_id).exists() or (
        command.origin == "http" and FieldEvent.objects.filter(pk=command.command_id).exists()
    ):
        raise CommunityConflictError("community_command_conflict")
    validate_words(command.values, facts["type_snapshot"])
    try:
        with transaction.atomic():
            sequence = (
                CommunityActivity.objects.filter(organization=command.actor.organization).aggregate(
                    value=Max("sequence")
                )["value"]
                or 0
            ) + 1
            activity = CommunityActivity.objects.create(
                id=command.command_id,
                organization=command.actor.organization,
                created_by=command.actor.user,
                sequence=sequence,
                code=f"A-{sequence:06d}",
                zone_id=command.values["zone_id"],
                zone_version_id=facts["zone_version_id"],
                type_id=command.values["type_id"],
                type_snapshot=facts["type_snapshot"],
                attendance=command.values["attendance"],
                agreements=command.values["agreements"],
                other_text=command.values["other_text"],
                activity_date=facts["activity_date"],
                captured_timezone=facts["timezone"],
            )
            _link_incident(command, activity)
            return _append_event(command, activity, ("create", facts["received_at"]))
    except IntegrityError as error:
        if getattr(getattr(error.__cause__, "diag", None), "constraint_name", None) in {
            "community_communityactivity_pkey",
            "community_event_command",
            "community_command_identity",
        }:
            raise CommunityConflictError("community_command_conflict") from error
        raise


def _append_event(
    command: ActivityCommand, activity: CommunityActivity, phase: tuple[str, str]
) -> dict[str, Any]:
    action, received_at = phase
    event = CommunityActivityEvent.objects.create(
        organization=activity.organization,
        created_by=command.actor.user,
        activity=activity,
        revision=1 if action == "create" else 2,
        action=action,
        command_id=command.command_id,
        origin=command.origin,
        device_time=command.device_time,
        server_received_at=received_at,
        declared_source_uuid=command.command_id if command.origin == "field" else None,
        source_payload_hash=command.source_hash,
        source_identity=command.source_identity,
        body_hash=_body_hash(command, action, activity.pk),
        reason=command.values.get("reason", ""),
        reason_code=command.values.get("reason_code", ""),
    )
    response = {
        "activity_id": str(activity.pk),
        "event_id": str(event.pk),
        "command_id": str(command.command_id),
        "code": activity.code,
        "revision": event.revision,
        "server_received_at": event.server_received_at
        if isinstance(event.server_received_at, str)
        else event.server_received_at.isoformat(),
    }
    CommunityCommandReceipt.objects.create(
        organization=activity.organization,
        created_by=command.actor.user,
        command_id=command.command_id,
        event=event,
        operation=action,
        target_id=activity.pk,
        origin=command.origin,
        body_hash=event.body_hash,
        command=json_value(command.values),
        response=json_value(response),
    )
    return response


def void_activity(command: ActivityCommand, identifier: UUID) -> dict[str, Any]:
    activity = visible_activity(command.actor, identifier, VOID)
    require_pair(current_scope(command.actor), READ, activity.zone)
    with community_transaction(command.actor, activity):
        activity = visible_activity(command.actor, identifier, VOID)
        require_pair(current_scope(command.actor), READ, activity.zone)
        result = void_activity_locked(command, activity)
        from community.history import publish_activity

        publish_activity(activity, CommunityActivityEvent.objects.get(pk=result["event_id"]))
        return result


def void_activity_locked(command: ActivityCommand, activity: CommunityActivity) -> dict[str, Any]:
    command = replace(
        command,
        values={
            **command.values,
            "reason": normalize_void_reason(command.values["reason"]),
        },
    )
    if replay := _replay(command, "void", activity.pk):
        return replay
    revision = activity.events.aggregate(value=Max("revision"))["value"] or 0
    if revision != 1 or command.values.get("expected_revision", 1) != revision:
        raise CommunityConflictError("community_revision_conflict")
    if command.origin == "http" and FieldEvent.objects.filter(pk=command.command_id).exists():
        raise CommunityConflictError("community_command_conflict")
    resolve_void_reason(
        activity.organization_id, command.values["reason"], command.values["reason_code"]
    )
    return _append_event(
        command, activity, ("void", (command.server_received_at or server_now()).isoformat())
    )
