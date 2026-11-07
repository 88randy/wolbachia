"""Only actual source-backed aggregates publish through the existing history owner."""

from uuid import UUID

from community.models import (
    CommunityActivity,
    CommunityActivityEvent,
    CommunitySourceCancellation,
    CommunitySourceLink,
)
from community.permissions import block_context
from community.policy import SOURCE_TYPE
from core.models import OrgScopedModel
from field_sync.models import FieldEvent
from reviews.effect_receipts import is_effective
from reviews.history import publish_history
from reviews.inspection import original_source_envelope
from reviews.scope import SubjectFacts


def _link(event: CommunityActivityEvent, source: FieldEvent) -> None:
    link = CommunitySourceLink.objects.filter(event=event).first()
    if link is not None:
        if link.source_event_id != source.pk:
            raise RuntimeError("Community source cannot be reparented.")
        return
    CommunitySourceLink.objects.create(
        organization=source.organization,
        created_by=source.created_by,
        event=event,
        source_event=source,
    )


def stored_source(source: FieldEvent, *, cause: OrgScopedModel | None = None) -> None:
    if source.type not in {SOURCE_TYPE, "record.void"}:
        return
    if not is_effective(source):
        return
    event = (
        CommunityActivityEvent.objects.filter(
            organization=source.organization,
            declared_source_uuid=source.pk,
            source_payload_hash=source.payload_sha256,
            created_by=source.created_by,
        )
        .select_related("activity__zone__quadrant")
        .first()
    )
    if source.type == SOURCE_TYPE:
        if event is None:
            raise RuntimeError("Effective community source requires its real operation.")
        _link(event, source)
    elif source.type == "record.void":
        target_id = original_source_envelope(source).voids_event_id
        if target_id is None:
            return
        target = FieldEvent.objects.filter(
            organization=source.organization,
            pk=target_id,
            type=SOURCE_TYPE,
            created_by=source.created_by,
        ).first()
        if target is None:
            return
        if event is None:
            _record_cancellation(source, target)
            return
        _link(event, source)
    else:
        return
    publish_activity(event.activity, cause or source)


def _record_cancellation(source: FieldEvent, target: FieldEvent) -> None:
    if target.voided_at is None or target.voided_by_id != source.created_by_id:
        raise RuntimeError("Community cancellation requires an actual source void.")
    if CommunityActivity.objects.filter(pk=target.pk).exists():
        raise RuntimeError("An operational activity needs its own actual void event.")
    if not CommunitySourceCancellation.objects.filter(
        source_event=source, target_event=target
    ).exists():
        CommunitySourceCancellation.objects.create(
            organization=source.organization,
            created_by=source.created_by,
            source_event=source,
            target_event=target,
            source_payload_hash=source.payload_sha256,
            reason=target.void_reason,
            reason_code=target.void_reason_code,
        )


def publish_activity(activity: CommunityActivity, cause: OrgScopedModel) -> None:
    creation = (
        CommunitySourceLink.objects.filter(
            organization=activity.organization, event__activity=activity, event__action="create"
        )
        .select_related("source_event__created_by")
        .first()
    )
    if creation is None or creation.source_event.created_by is None:
        return  # HTTP captures never invent an original courier/source.
    latest = activity.events.order_by("-revision").first()
    if latest is None:
        raise RuntimeError("Community activity requires its immutable create event.")
    source = creation.source_event
    payload = {
        "id": str(activity.pk),
        "kind": "community_activity",
        "activity_id": str(activity.pk),
        "event_id": str(latest.pk),
        "command_id": str(latest.command_id),
        "code": activity.code,
        "revision": latest.revision,
        "type_id": str(activity.type_id),
        "type_snapshot": activity.type_snapshot,
        "zone_id": str(activity.zone_id),
        "zone_version_id": str(activity.zone_version_id),
        "activity_date": activity.activity_date.isoformat()
        if hasattr(activity.activity_date, "isoformat")
        else activity.activity_date,
        "attendance": activity.attendance,
        "is_voided": latest.action == "void",
        "source_event_id": str(source.pk),
        "source_device_time": source.device_time.isoformat(),
        "source_server_received_at": source.server_received_at.isoformat(),
        "subjects": [block_context(activity.zone)],
    }
    publish_history("community_activity", cause, source.created_by, payload)


def history_subjects(organization_id: UUID, courier_id: UUID, activity_id: UUID) -> SubjectFacts:
    activity = (
        CommunityActivity.objects.filter(
            organization_id=organization_id,
            pk=activity_id,
            events__action="create",
            events__source_link__source_event__created_by_id=courier_id,
        )
        .select_related("zone__quadrant")
        .first()
    )
    return (
        SubjectFacts()
        if activity is None
        else SubjectFacts(True, (block_context(activity.zone),), "community_activity", activity.pk)
    )
