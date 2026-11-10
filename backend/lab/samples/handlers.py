"""Sample sources use the existing sync transaction and immutable review lifecycle."""

from typing import Any
from uuid import UUID

from django.db.models import Q
from django.http import Http404
from rest_framework import serializers

from core.void_reason import validate_void_reason, visible_length
from field_sync.envelope import BatchContext, EventEnvelope
from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext, EventHandler, register
from lab.samples.payloads import SampleCollectPayload
from uploads.access import UploadActor

SAMPLE_EVENT = "sample.collect"
SAMPLE_CODES = (
    "sample_inaccessible",
    "sample_configuration_unavailable",
    "sample_source_unavailable",
    "sample_state_conflict",
    "sample_evidence_required",
    "sample_void_blocked",
)


def source_references(ctx: EventContext) -> set[UUID]:
    """Discover real original sources before account/session locks, never lock them late."""
    from lab.samples.services import resolve_source

    payload = SampleCollectPayload(data=ctx.envelope.payload)
    if not payload.is_valid():
        return set()
    values = dict(payload.validated_data)
    authorize_collection(ctx, values)
    source = resolve_source(ctx.organization, values["source_ref"])
    return {source.event_id} if source.event_id is not None else set()


def authorize_collection(ctx: EventContext, values: dict[str, Any]) -> None:
    """Check current complete authority before causal pending/replay can reveal facts."""
    from lab.samples.services import require_source_scope, resolve_source

    actor = UploadActor(ctx.user, ctx.organization, ctx.device.pk)
    try:
        source = resolve_source(ctx.organization, values["source_ref"])
        require_source_scope(actor, source, "field_event.sync")
        require_source_scope(actor, source, SAMPLE_EVENT)
    except Http404:
        raise EventRejected("sample_inaccessible") from None


def authorize_void(ctx: EventContext, target: FieldEvent) -> None:
    from field_sync.handlers.void import VoidPayloadSerializer
    from field_sync.services import rejection_params
    from lab.samples.services import require_source_scope, resolve_source
    from reviews.inspection import validated_original_payload

    if (
        target.type != SAMPLE_EVENT
        or target.organization_id != ctx.organization.pk
        or target.created_by_id != ctx.user.pk
    ):
        raise EventRejected("sample_inaccessible")
    try:
        source = resolve_source(ctx.organization, validated_original_payload(target)["source_ref"])
        actor = UploadActor(ctx.user, ctx.organization, ctx.device.pk)
        require_source_scope(actor, source, "field_event.sync")
        require_source_scope(actor, source, "sample.void")
        payload = VoidPayloadSerializer(data=ctx.envelope.payload)
        payload.is_valid(raise_exception=True)
        reason = validate_void_reason(
            payload.validated_data["reason"], "reason", enforce_minimum=False
        )
        if visible_length(reason) < 10:
            raise EventRejected(
                "invalid_payload", {"fields": {"reason": ["void_reason_too_short"]}}
            )
    except Http404:
        raise EventRejected("sample_inaccessible") from None
    except serializers.ValidationError as error:
        raise EventRejected("invalid_payload", rejection_params(error)) from None


def apply_collection(ctx: EventContext, values: dict[str, Any]) -> None:
    from field_sync.services import rejection_params
    from lab.samples.services import collect_sample

    authorize_collection(ctx, values)
    try:
        collect_sample(ctx, values)
    except Http404:
        raise EventRejected("sample_inaccessible") from None
    except serializers.ValidationError as error:
        raise EventRejected("invalid_payload", rejection_params(error)) from None


def on_void(ctx: EventContext, target: FieldEvent) -> None:
    from field_sync.services import rejection_params
    from lab.samples.services import sample_void

    authorize_void(ctx, target)
    try:
        sample_void(ctx, target)
    except Http404:
        raise EventRejected("sample_inaccessible") from None
    except serializers.ValidationError as error:
        raise EventRejected("invalid_payload", rejection_params(error)) from None


def protect_sample_dependents(ctx: EventContext, target: FieldEvent) -> None:
    """A real source remains effective until each dependent sample is corrected first."""
    from lab.samples.models import WolbachiaSample

    if (
        WolbachiaSample.objects.filter(
            organization=ctx.organization,
            event__voided_at__isnull=True,
        )
        .filter(Q(reading__event=target) | Q(release__declared_event_id=target.pk))
        .exists()
    ):
        raise EventRejected("sample_void_blocked")


def replay_code(batch: BatchContext, envelope: EventEnvelope, stored_type: str) -> str | None:
    from reviews.inspection import original_source_envelope, validated_original_payload
    from reviews.source_identity import envelope_metadata, same_envelope

    source = FieldEvent.objects.filter(
        organization=batch.organization, pk=envelope.id, created_by=batch.user
    ).first()
    target = (
        None
        if source is None or source.type != "record.void"
        else FieldEvent.objects.filter(
            organization=batch.organization,
            pk=source.voids_event_id,
            created_by=batch.user,
            type=SAMPLE_EVENT,
        ).first()
    )
    if stored_type != SAMPLE_EVENT and envelope.type != SAMPLE_EVENT and target is None:
        return None
    if source is None:
        return "event_id_conflict"
    try:
        original = original_source_envelope(source)
        if not same_envelope(envelope_metadata(original), envelope):
            return "event_id_conflict"
        ctx = EventContext(
            batch.organization, batch.user, batch.device, original, batch.received_at
        )
        if target is not None:
            authorize_void(ctx, target)
        else:
            authorize_collection(ctx, validated_original_payload(source))
    except (EventRejected, Http404, serializers.ValidationError, ValueError, KeyError):
        return "sample_inaccessible"
    return None


def register_sample_handler() -> None:
    from lab.samples.review import SampleReviewAdapter

    register(
        EventHandler(
            SAMPLE_EVENT,
            1,
            SampleCollectPayload,
            apply_collection,
            on_void=on_void,
            codes=SAMPLE_CODES,
            review_adapter=SampleReviewAdapter(),
        )
    )
