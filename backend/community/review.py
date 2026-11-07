"""Original aggregate facts survive rollback; canonical B17 owns decision and effect receipt."""

from datetime import date, datetime
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from django.http import Http404
from rest_framework import serializers

from catalogs.models import CatalogItem, CatalogSnapshot
from community.exceptions import CommunityConflictError
from community.models import CommunityActivity, CommunityActivityEvent, CommunitySourceCancellation
from community.payloads import CommunityActivityPayload
from community.permissions import require_pair
from community.policy import (
    CATALOG_SLUG,
    CREATE,
    SOURCE_TYPE,
    VOID,
    json_value,
    normalize_void_reason,
    validate_words,
)
from community.services import ActivityCommand, create_activity_locked, void_activity_locked
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext, EventHandler, register
from geography.models import Block, BlockVersion
from organizations.models import Organization
from organizations.scope import EffectiveScope
from reviews.contracts import ReviewAdapter
from reviews.exceptions import ReviewBlockedError
from reviews.inspection import ExistingEffect, original_source_envelope
from reviews.source_identity import envelope_metadata
from uploads.access import UploadActor, current_scope

COMMUNITY_CODES = (
    "community_inaccessible",
    "community_command_conflict",
    "community_catalog_unavailable",
    "community_catalog_deactivated",
    "community_configuration_unavailable",
    "community_zone_unavailable",
    "community_state_conflict",
)


def source_scope(ctx: EventContext) -> EffectiveScope:
    return (
        ctx.review_authorization.historical_scope
        if ctx.review_authorization
        else current_scope(UploadActor(ctx.user, ctx.organization, ctx.device.pk))
    )


def source_block(ctx: EventContext, values: dict[str, Any], permission: str = CREATE) -> Block:
    block = (
        Block.objects.filter(
            organization=ctx.organization,
            pk=values["zone_id"],
            quadrant__organization=ctx.organization,
            quadrant__center__organization=ctx.organization,
        )
        .select_related("quadrant")
        .first()
    )
    if block is None:
        raise EventRejected("community_inaccessible")
    try:
        scope = source_scope(ctx)
        require_pair(scope, "field_event.sync", block)
        require_pair(scope, permission, block)
    except Http404:
        raise EventRejected("community_inaccessible") from None
    if permission == CREATE and values.get("incident_id") is not None:
        _require_incident(ctx, values, cast(Block, block))
    return cast(Block, block)


def _require_incident(ctx: EventContext, values: dict[str, Any], block: Block) -> None:
    from incidents.models import Incident

    if not Incident.objects.filter(
        organization=ctx.organization,
        pk=values["incident_id"],
        center_id=block.quadrant.center_id,
        quadrant_id=block.quadrant_id,
    ).exists():
        raise EventRejected("community_inaccessible")
    try:
        require_pair(source_scope(ctx), "incident.read", block)
    except Http404:
        raise EventRejected("community_inaccessible") from None


def _require_current_incident_reviewer(ctx: EventContext, values: dict[str, Any]) -> None:
    """Inspection proves original facts; only an actual acceptance actor may link them now."""
    if ctx.review_authorization is None or values.get("incident_id") is None:
        return
    reviewer = ctx.review_authorization.reviewer_actor
    if reviewer is None:
        raise EventRejected("community_inaccessible")
    block = source_block(ctx, values)
    try:
        require_pair(current_scope(reviewer), "incident.read", block)
    except Http404:
        raise EventRejected("community_inaccessible") from None


def capture_facts(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    block = source_block(ctx, values)
    if ctx.review_authorization:
        facts = ctx.review_authorization.owner_facts.get("community", {})
        if not isinstance(facts, dict) or not _valid_original_facts(facts, ctx):
            raise ReviewBlockedError(("capture_context_unavailable",))
        if (
            facts.get("version") != 1
            or not facts.get("available")
            or facts.get("zone_id") != str(block.pk)
            or facts.get("type_id") != str(values["type_id"])
        ):
            raise ReviewBlockedError(("capture_context_unavailable",))
        if facts.get("command") != json_value(values):
            raise ReviewBlockedError(("capture_context_unavailable",))
        if not BlockVersion.objects.filter(
            organization=ctx.organization,
            block=block,
            pk=facts["zone_version_id"],
            effective_from__lte=ctx.envelope.device_time,
        ).exists():
            raise ReviewBlockedError(("capture_context_unavailable",))
        return dict(facts)
    snapshot = CatalogSnapshot.objects.filter(
        organization=ctx.organization, version=ctx.envelope.catalog_version
    ).first()
    if snapshot is None:
        raise EventNeedsReview("community_catalog_unavailable")
    choices = _snapshot_choices(snapshot.content, values["type_id"])
    if len(choices) != 1:
        raise EventRejected("community_inaccessible")
    version = (
        BlockVersion.objects.filter(
            organization=ctx.organization, block=block, effective_from__lte=ctx.envelope.device_time
        )
        .order_by("-effective_from", "-revision")
        .first()
    )
    if version is None:
        raise EventNeedsReview("community_zone_unavailable")
    organization = Organization.objects.get(pk=ctx.organization.pk)
    return {
        "version": 1,
        "available": True,
        "command": json_value(values),
        "zone_id": str(block.pk),
        "zone_version_id": str(version.pk),
        "type_id": str(values["type_id"]),
        "type_snapshot": dict(choices[0]),
        "catalog_version": snapshot.version,
        "activity_date": ctx.envelope.device_time.astimezone(ZoneInfo(organization.timezone))
        .date()
        .isoformat(),
        "timezone": organization.timezone,
        "received_at": ctx.server_received_at.isoformat(),
    }


def _snapshot_choices(content: Any, identifier: UUID) -> list[dict[str, Any]]:  # noqa: ANN401 -- retained JSON boundary
    catalogs = content.get("catalogs") if isinstance(content, dict) else None
    if not isinstance(catalogs, list):
        raise EventNeedsReview("community_catalog_unavailable")
    choices = []
    for catalog in catalogs:
        if not isinstance(catalog, dict) or not isinstance(catalog.get("items"), list):
            raise EventNeedsReview("community_catalog_unavailable")
        if catalog.get("slug") == CATALOG_SLUG:
            for item in catalog["items"]:
                if not isinstance(item, dict):
                    raise EventNeedsReview("community_catalog_unavailable")
                if item.get("id") == str(identifier):
                    if not _valid_type_snapshot(item):
                        raise EventNeedsReview("community_catalog_unavailable")
                    choices.append(dict(item))
    return choices


def _valid_type_snapshot(snapshot: object) -> bool:
    return (
        isinstance(snapshot, dict)
        and all(isinstance(snapshot.get(key), str) for key in ("code", "label_es", "label_en"))
        and type(snapshot.get("is_other")) is bool
        and type(snapshot.get("requires_photo")) is bool
    )


def _valid_original_facts(facts: dict[str, Any], ctx: EventContext) -> bool:
    snapshot = facts.get("type_snapshot")
    if not _valid_type_snapshot(snapshot):
        return False
    try:
        UUID(facts["zone_version_id"])
        day = date.fromisoformat(facts["activity_date"])
        received = datetime.fromisoformat(facts["received_at"])
        zone = ZoneInfo(facts["timezone"])
    except (KeyError, TypeError, ValueError):
        return False
    return (
        received == ctx.server_received_at
        and day.isoformat() == facts["activity_date"]
        and ctx.envelope.device_time.astimezone(zone).date() == day
        and isinstance(snapshot, dict)
        and snapshot.get("id", facts.get("type_id")) == facts.get("type_id")
    )


def _require_type(ctx: EventContext, facts: dict[str, Any]) -> None:
    item = CatalogItem.objects.filter(
        organization=ctx.organization,
        catalog__organization=ctx.organization,
        catalog__slug=CATALOG_SLUG,
        pk=facts["type_id"],
        code=facts["type_snapshot"]["code"],
    ).first()
    if item is None:
        raise EventRejected("community_inaccessible")
    if item.requires_photo or facts["type_snapshot"].get("requires_photo") is not False:
        raise EventNeedsReview("community_configuration_unavailable")
    if not item.is_active and not ctx.acknowledges("community_catalog_deactivated"):
        raise EventNeedsReview("community_catalog_deactivated")


def source_command(ctx: EventContext, values: dict[str, Any]) -> ActivityCommand:
    return ActivityCommand(
        actor=UploadActor(ctx.user, ctx.organization, ctx.device.pk),
        command_id=ctx.envelope.id,
        values=values,
        origin="field",
        source_identity=envelope_metadata(ctx.envelope),
        source_hash=ctx.envelope.payload_info.sha256,
        device_time=ctx.envelope.device_time,
        server_received_at=ctx.server_received_at,
        scope=source_scope(ctx),
    )


def apply_source(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    facts = capture_facts(ctx, values)
    _require_current_incident_reviewer(ctx, values)
    ctx.observed_facts["community"] = facts
    try:
        validate_words(values, facts["type_snapshot"])
    except serializers.ValidationError as error:
        from field_sync.services import rejection_params

        raise EventRejected("invalid_payload", rejection_params(error)) from None
    _require_type(ctx, facts)
    if ctx.review_code is not None and not ctx.acknowledges(ctx.review_code):
        raise EventNeedsReview(ctx.review_code)
    try:
        return create_activity_locked(source_command(ctx, values), facts)
    except CommunityConflictError as error:
        raise EventRejected("community_command_conflict") from error
    except Http404:
        raise EventRejected("community_inaccessible") from None
    except serializers.ValidationError as error:
        from field_sync.services import rejection_params

        raise EventRejected("invalid_payload", rejection_params(error)) from None


def _source_void_reason(payload: dict[str, Any]) -> str:
    from field_sync.handlers.void import VoidPayloadSerializer

    body = VoidPayloadSerializer(data=payload)
    body.is_valid(raise_exception=True)
    return normalize_void_reason(body.validated_data["reason"])


def authorize_void(ctx: EventContext, target: FieldEvent) -> None:
    if (
        target.type != SOURCE_TYPE
        or target.organization_id != ctx.organization.pk
        or target.created_by_id != ctx.user.pk
    ):
        raise EventRejected("community_inaccessible")
    source_block(ctx, original_source_envelope(target).payload, VOID)
    try:
        _source_void_reason(ctx.envelope.payload)
    except serializers.ValidationError as error:
        from field_sync.services import rejection_params

        raise EventRejected("invalid_payload", rejection_params(error)) from None


def on_void(ctx: EventContext, target: FieldEvent) -> None:
    authorize_void(ctx, target)
    activity = CommunityActivity.objects.filter(organization=ctx.organization, pk=target.pk).first()
    if activity is None:
        from reviews.models import ReviewSourceSnapshot

        snapshot = ReviewSourceSnapshot.objects.filter(
            source_event=target,
            organization=ctx.organization,
            created_by=ctx.user,
        ).first()
        if target.status != "in_review" or snapshot is None:
            raise EventRejected("community_state_conflict")
        return
    try:
        void_activity_locked(
            source_command(
                ctx, {"reason": target.void_reason, "reason_code": target.void_reason_code}
            ),
            activity,
        )
    except CommunityConflictError as error:
        raise EventRejected("community_state_conflict") from error


def void_materialization(source_id: UUID, target: FieldEvent) -> dict[str, Any]:
    event = CommunityActivityEvent.objects.filter(
        organization=target.organization,
        declared_source_uuid=source_id,
        activity_id=target.pk,
        action="void",
    ).first()
    return {
        "target_event_id": str(target.pk),
        "voided_at": target.voided_at.isoformat() if target.voided_at else None,
        "community_event_id": str(event.pk) if event else None,
        "community_canceled_source_id": str(target.pk) if event is None else None,
    }


def inspect_void(source: FieldEvent, target: FieldEvent) -> ExistingEffect:
    facts = void_materialization(source.pk, target)
    cancellation = CommunitySourceCancellation.objects.filter(
        source_event=source,
        target_event=target,
        organization=source.organization,
        source_payload_hash=source.payload_sha256,
        created_by=source.created_by,
        reason=target.void_reason,
        reason_code=target.void_reason_code,
    ).exists()
    if (
        target.voided_by_id == source.created_by_id
        and target.voided_at
        and (facts["community_event_id"] or cancellation)
    ):
        return ExistingEffect("complete_owned", facts)
    return ExistingEffect("partial", blockers=("void_effect_unavailable",))


class CommunityReviewAdapter(ReviewAdapter):
    reviewable_codes = frozenset(
        {
            "clock_skew",
            "final_upload_after_revoke",
            "causal_parent_pending",
            "community_catalog_deactivated",
            "community_catalog_unavailable",
            "community_zone_unavailable",
            "community_configuration_unavailable",
        }
    )

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        facts = capture_facts(ctx, data)
        ctx.observed_facts["community"] = facts
        return {"community": facts}

    def capture_observations(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        if "community" in ctx.observed_facts:
            return {"community": dict(ctx.observed_facts["community"])}
        try:
            return {"community": capture_facts(ctx, data)}
        except EventNeedsReview:
            return {"community": {"version": 1, "available": False}}

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        from reviews.inspection import validated_original_payload

        capture_facts(ctx, validated_original_payload(source))
        event = CommunityActivityEvent.objects.filter(
            organization=source.organization,
            declared_source_uuid=source.pk,
            source_payload_hash=source.payload_sha256,
            created_by=source.created_by,
            action="create",
            source_identity=envelope_metadata(ctx.envelope),
        ).first()
        if event is None:
            return ExistingEffect()
        if not hasattr(event, "receipt"):
            return ExistingEffect("partial", blockers=("community_receipt_unavailable",))
        return ExistingEffect(
            "complete_owned",
            {
                "community_activity_id": str(event.activity_id),
                "community_event_id": str(event.pk),
                "command_id": str(event.command_id),
            },
        )

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        receipt = apply_source(ctx, data)
        return {
            "community_activity_id": receipt["activity_id"],
            "community_event_id": receipt["event_id"],
            "command_id": receipt["command_id"],
        }


def register_community_handler() -> None:
    def apply(ctx: EventContext, data: dict[str, Any]) -> None:
        apply_source(ctx, data)

    register(
        EventHandler(
            SOURCE_TYPE,
            1,
            CommunityActivityPayload,
            apply,
            on_void=on_void,
            codes=COMMUNITY_CODES,
            review_adapter=CommunityReviewAdapter(),
        )
    )


def replay_code(batch: Any, envelope: Any, stored_type: str) -> str | None:  # noqa: ANN401 -- internal canonical batch/envelope
    """None permits legacy/default replay; this domain fails closed on a missing original frame."""
    from reviews.models import ReviewSourceSnapshot
    from reviews.source_identity import same_envelope

    snapshot = (
        ReviewSourceSnapshot.objects.filter(
            source_event_id=envelope.id, organization=batch.organization
        )
        .select_related("source_event")
        .first()
    )
    original = None if snapshot is None else original_source_envelope(snapshot.source_event)
    target = None
    if (
        stored_type == "record.void"
        and original is not None
        and original.voids_event_id is not None
    ):
        target = FieldEvent.objects.filter(
            organization=batch.organization,
            pk=original.voids_event_id,
            type=SOURCE_TYPE,
            created_by=batch.user,
        ).first()
    if stored_type != SOURCE_TYPE and envelope.type != SOURCE_TYPE and target is None:
        return None
    if (
        snapshot is None
        or original is None
        or not same_envelope(snapshot.original_envelope, envelope)
    ):
        return "event_id_conflict"
    ctx = EventContext(batch.organization, batch.user, batch.device, original, batch.received_at)
    try:
        if target is not None:
            authorize_void(ctx, target)
        else:
            source_block(ctx, original.payload)
    except (Http404, EventRejected, ValueError):
        return "community_inaccessible"
    return None
