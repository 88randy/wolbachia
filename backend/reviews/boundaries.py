"""Preparation locks live outside the operational savepoint and survive its rollback."""

from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from typing import Any
from uuid import UUID

from field_sync.envelope import BatchContext, EventEnvelope
from field_sync.models import FieldEvent
from field_sync.registry import EventContext, EventHandler
from organizations.models import Organization
from reviews.contracts import HandlerPreparation
from reviews.dependencies import BatchCandidates, classify_dependencies
from reviews.scope import SubjectFacts, subject_facts, vector_allows


def lock_source_references(ctx: EventContext) -> None:
    from shifts.models import Shift

    identifiers = set()
    if ctx.envelope.type in {"transfer.dispatch", "transfer.receive"}:
        from inventory.transfers.dependencies import source_references
        from inventory.transfers.review import authorize_source

        authorize_source(ctx, ctx.envelope.payload)
        identifiers.update(source_references(ctx.organization, ctx.envelope.payload))
    if ctx.envelope.voids_event_id is not None:
        owned_target = FieldEvent.objects.filter(
            organization=ctx.organization, created_by=ctx.user, pk=ctx.envelope.voids_event_id
        ).first()
        if owned_target is not None:
            identifiers.add(owned_target.pk)
    if ctx.envelope.shift_id is not None:
        shift = Shift.objects.filter(
            organization=ctx.organization, pk=ctx.envelope.shift_id, courier=ctx.user
        ).first()
        if shift is not None:
            identifiers.add(shift.opened_event_id)
    marker_source_id = _authorized_marker_source(ctx)
    if marker_source_id is not None:
        identifiers.add(marker_source_id)
    list(
        FieldEvent.objects.filter(organization=ctx.organization, pk__in=identifiers)
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )


def _authorized_marker_source(ctx: EventContext) -> UUID | None:
    if (
        ctx.envelope.type not in {"incident.report", "emergency.accident"}
        or ctx.review_code is not None
    ):
        return None
    from django.http import Http404

    from field_sync.exceptions import EventNeedsReview, EventRejected
    from incidents.handlers import INCIDENT_INACCESSIBLE, _source_context
    from incidents.selectors import require_context
    from uploads.access import UploadActor, current_scope

    try:
        context = _source_context(ctx, ctx.envelope.payload)
    except EventNeedsReview:
        return None
    scope = current_scope(UploadActor(ctx.user, ctx.organization, ctx.device.pk))
    try:
        require_context(scope, "field_event.sync", context)
        require_context(scope, "incident.create", context)
    except Http404:
        raise EventRejected(INCIDENT_INACCESSIBLE) from None
    return None if context.marker is None else context.marker.event_id


def prepare_target_domain(ctx: EventContext, target: FieldEvent) -> None:
    from ovitraps.selectors import accessible_ovitrap, accessible_point
    from reviews.inspection import original_source_envelope

    try:
        envelope = original_source_envelope(target)
    except ValueError:
        from field_sync.exceptions import EventRejected

        raise EventRejected("void_target_not_found") from None
    subjects = subject_facts(ctx.organization, envelope)
    if subjects.resource_kind == "sampling_point" and subjects.resource_id is not None:
        if target.type == "ovitrap.place":
            accessible_point(ctx, subjects.resource_id)
        else:
            accessible_ovitrap(ctx, envelope.payload["ovitrap_id"])


def retain_domain_boundary(
    ctx: EventContext, handler: EventHandler, subjects: SubjectFacts
) -> None:
    """Retain actual work-frame safety/allocation locks before point and upload locks."""
    if not handler.checks_shift or (
        ctx.envelope.type in {"incident.report", "emergency.accident"}
        and ctx.review_code is not None
        and ctx.review_authorization is None
    ):
        return
    from field_sync.exceptions import EventRejected
    from shifts.models import Motorcycle, Shift
    from uploads.access import UploadActor, current_scope

    scope = (
        ctx.review_authorization.historical_scope
        if ctx.review_authorization
        else current_scope(UploadActor(ctx.user, ctx.organization, ctx.device.pk))
    )
    if subjects.resolved and not vector_allows(scope, "field_event.sync", subjects.contexts):
        code = (
            "ovitrap_point_inaccessible"
            if ctx.envelope.type == "ovitrap.place"
            else "ovitrap_inaccessible"
        )
        if subjects.resource_kind == "motorcycle":
            code = "motorcycle_unknown"
        raise EventRejected(code)
    shift = (
        None
        if ctx.envelope.shift_id is None
        else Shift.objects.filter(
            organization=ctx.organization, courier=ctx.user, pk=ctx.envelope.shift_id
        ).first()
    )
    if (
        shift is not None
        and ctx.envelope.type == "fuel.load"
        and subjects.resource_id != shift.motorcycle_id
    ):
        raise EventRejected("fuel_motorcycle_mismatch")
    identifiers = set()
    if shift is not None:
        identifiers.add(shift.motorcycle_id)
    if subjects.resource_kind == "motorcycle" and subjects.resource_id is not None:
        identifiers.add(subjects.resource_id)
    list(
        Motorcycle.objects.filter(organization=ctx.organization, pk__in=identifiers)
        .order_by("pk")
        .select_for_update(nowait=True)
    )
    if shift is not None:
        Shift.objects.select_for_update(nowait=True).get(pk=shift.pk)


@contextmanager
def prepare_ingest(  # noqa: PLR0913 -- explicit batch, source, registered handler and causal preparation
    batch: BatchContext,
    envelope: EventEnvelope,
    handler: EventHandler,
    data: dict[str, Any],
    candidates: BatchCandidates,
    review_code: str | None,
) -> Iterator[HandlerPreparation]:
    if handler.review_adapter is None:
        yield HandlerPreparation(subjects=subject_facts(batch.organization, envelope))
        return
    ctx = EventContext(
        batch.organization, batch.user, batch.device, envelope, batch.received_at, review_code
    )
    lock_source_references(ctx)
    Organization.objects.select_for_update(nowait=True, no_key=True).get(pk=batch.organization.pk)
    if envelope.type == "community.activity":
        from community.review import source_block

        source_block(ctx, data)
    causal = classify_dependencies(batch, envelope, candidates)
    subjects = subject_facts(batch.organization, envelope)
    with ExitStack() as stack:
        if subjects.resource_kind == "transfer":
            from inventory.transactions import inventory_transaction

            stack.enter_context(inventory_transaction(organization=batch.organization))
        if causal.pending_code is None:
            retain_domain_boundary(ctx, handler, subjects)
            subjects = subject_facts(batch.organization, envelope)
        if (
            subjects.resource_kind == "sampling_point"
            and subjects.resource_id is not None
            and causal.pending_code is None
        ):
            from field_sync.services import fanout_courier_changes
            from geography.models import SamplingPoint
            from ovitraps.services import point_fanout_scope

            point = SamplingPoint.objects.get(pk=subjects.resource_id)
            stack.enter_context(fanout_courier_changes(point_fanout_scope(point)))
        pending_code = causal.pending_code
        owner_facts: dict[str, Any] = {}
        if handler.review_adapter is not None and pending_code is None:
            from field_sync.exceptions import EventNeedsReview

            try:
                owner_facts = handler.review_adapter.prepare_boundary(ctx, data) or {}
            except EventNeedsReview as observation:
                pending_code = observation.code
        yield HandlerPreparation(
            subjects, causal.dependencies, causal.claims, pending_code, owner_facts
        )
