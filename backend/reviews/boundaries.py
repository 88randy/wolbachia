"""Preparation locks live outside the operational savepoint and survive its rollback."""

from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from uuid import UUID

from field_sync.envelope import BatchContext, EventEnvelope
from field_sync.models import FieldEvent
from field_sync.registry import EventContext, EventHandler
from organizations.models import Organization
from reviews.contracts import HandlerPreparation
from reviews.dependencies import BatchCandidates, classify_dependencies
from reviews.scope import SubjectFacts, subject_facts, vector_allows

if TYPE_CHECKING:
    from uploads.access import UploadActor


@dataclass(frozen=True)
class BatchPreparation:
    """Only authentic existing row identities; candidate IDs are declared by this batch."""

    users: tuple[UUID, ...]
    sources: tuple[tuple[UUID, UUID], ...]
    candidates: frozenset[UUID]
    retains_organization: bool


@dataclass(frozen=True)
class ReviewUserPreparation:
    source_id: UUID
    source_authors: dict[UUID, UUID | None]
    humans: frozenset[UUID]


_batch_preparation: ContextVar[BatchPreparation | None] = ContextVar(
    "review_batch_preparation", default=None
)


def current_batch_preparation() -> BatchPreparation | None:
    return _batch_preparation.get()


def prepare_batch_participants(
    batch: BatchContext, envelopes: list[EventEnvelope]
) -> BatchPreparation:
    from field_sync.registry import get_handler

    identifiers: set[UUID] = set()
    users = {batch.user.pk}
    for envelope in envelopes:
        context = EventContext(
            batch.organization, batch.user, batch.device, envelope, batch.received_at
        )
        identifiers.update(_batch_source_ids(context))
        users.update(_domain_users(context))
    rows = list(FieldEvent.objects.filter(organization=batch.organization, pk__in=identifiers))
    if any(row.created_by_id is None for row in rows):
        from field_sync.exceptions import SyncInProgressError

        raise SyncInProgressError
    users.update(row.created_by_id for row in rows)
    retains = any(
        (handler := get_handler(envelope.type, envelope.schema_version)) is not None
        and handler.review_adapter is not None
        for envelope in envelopes
    )
    return BatchPreparation(
        tuple(sorted(users)),
        tuple(sorted((row.pk, row.created_by_id) for row in rows)),
        frozenset(envelope.id for envelope in envelopes),
        retains,
    )


def _batch_source_ids(ctx: EventContext) -> set[UUID]:
    from field_sync.exceptions import EventNeedsReview, EventRejected
    from shifts.models import Shift

    identifiers = set(
        FieldEvent.objects.filter(
            organization=ctx.organization, created_by=ctx.user, pk=ctx.envelope.id
        ).values_list("pk", flat=True)
    )
    if ctx.envelope.voids_event_id is not None:
        identifiers.update(
            FieldEvent.objects.filter(
                organization=ctx.organization, created_by=ctx.user, pk=ctx.envelope.voids_event_id
            ).values_list("pk", flat=True)
        )
    if ctx.envelope.shift_id is not None:
        identifiers.update(
            Shift.objects.filter(
                organization=ctx.organization, courier=ctx.user, pk=ctx.envelope.shift_id
            ).values_list("opened_event_id", flat=True)
        )
    try:
        if ctx.envelope.type in {"transfer.dispatch", "transfer.receive"}:
            from inventory.transfers.dependencies import source_references as transfer_references
            from inventory.transfers.review import authorize_source

            authorize_source(ctx, ctx.envelope.payload)
            identifiers.update(transfer_references(ctx.organization, ctx.envelope.payload))
        if ctx.envelope.type in {"supplies.receive", "supplies.reconcile"}:
            from inventory.allocations.review import authorize_source
            from inventory.allocations.review import source_references as supply_references

            authorize_source(ctx, ctx.envelope.payload)
            identifiers.update(supply_references(ctx))
        marker = _authorized_marker_source(ctx)
        if marker is not None:
            identifiers.add(marker)
    except (EventRejected, EventNeedsReview, KeyError, TypeError, ValueError):
        pass  # The regular per-event validator retains precedence and immutable rejection.
    return identifiers


def _domain_users(ctx: EventContext) -> set[UUID]:
    from inventory.allocations.transactions import assignment_participants

    if ctx.envelope.type in {"supplies.receive", "supplies.reconcile"}:
        from inventory.allocations.review import source_participants

        return set(source_participants(ctx))
    if ctx.envelope.type == "shift.close":
        from inventory.allocations.reconciliation import close_assignment_rows

        return {
            identifier
            for assignment in close_assignment_rows(ctx)
            for identifier in assignment_participants(assignment).users
        }
    if ctx.envelope.type == "record.void" and ctx.envelope.voids_event_id is not None:
        from dataclasses import replace

        from reviews.inspection import original_source_envelope

        target = (
            FieldEvent.objects.filter(
                organization=ctx.organization,
                pk=ctx.envelope.voids_event_id,
                created_by=ctx.user,
                type__in=("supplies.receive", "supplies.reconcile"),
            )
            .exclude(status="rejected")
            .first()
        )
        if target is not None:
            return _domain_users(replace(ctx, envelope=original_source_envelope(target)))
    return set()


def _review_domain_users(source: FieldEvent) -> set[UUID]:
    author = source.created_by
    if author is None:
        return set()
    from inventory.allocations.models import SupplyAssignment
    from inventory.allocations.transactions import assignment_participants
    from reviews.inspection import original_source_envelope

    if source.type in {"supplies.receive", "supplies.reconcile"}:
        try:
            identifier = UUID(str(source.payload.get("assignment_id")))
        except (AttributeError, TypeError, ValueError):
            return set()
        assignment = SupplyAssignment.objects.filter(
            organization=source.organization, pk=identifier, courier_id=source.created_by_id
        ).first()
        return set() if assignment is None else set(assignment_participants(assignment).users)
    try:
        envelope = original_source_envelope(source)
    except ValueError:
        return set()
    context = EventContext(
        source.organization, author, source.device, envelope, source.server_received_at
    )
    if source.type == "record.void" and context.envelope.voids_event_id is not None:
        target = FieldEvent.objects.filter(
            organization=source.organization,
            pk=context.envelope.voids_event_id,
            created_by=source.created_by,
            type__in=("supplies.receive", "supplies.reconcile", "shift.close"),
        ).first()
        return set() if target is None else _review_domain_users(target)
    return _domain_users(context) if source.type == "shift.close" else set()


@contextmanager
def prepared_batch_boundary(prepared: BatchPreparation) -> Iterator[None]:
    token = _batch_preparation.set(prepared)
    try:
        yield
    finally:
        _batch_preparation.reset(token)


def require_prepared_source_ids(identifiers: set[UUID]) -> None:
    prepared = _batch_preparation.get()
    if prepared is not None and not identifiers.issubset(
        {row[0] for row in prepared.sources} | prepared.candidates
    ):
        from field_sync.exceptions import SyncInProgressError

        raise SyncInProgressError


@contextmanager
def prepare_review_users(
    actor: "UploadActor", source: FieldEvent, references: set[UUID]
) -> Iterator[ReviewUserPreparation]:
    """Extend the SAME review transaction with authentic known-source authors, before sessions."""
    from django.db import DatabaseError, transaction

    from accounts.models import User
    from field_sync.exceptions import SyncInProgressError
    from field_sync.services import RETRYABLE_SQLSTATES, set_batch_lock_timeout

    identities = dict(
        FieldEvent.objects.filter(
            organization=actor.organization, pk__in=references | {source.pk}
        ).values_list("pk", "created_by_id")
    )
    humans = {
        actor.user.pk,
        source.review_item.courier_id,
        *_review_domain_users(source),
        *(identifier for identifier in identities.values() if identifier is not None),
    }
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            rows = list(
                User.objects.filter(pk__in=humans)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            if len(rows) != len(humans):
                raise SyncInProgressError
            yield ReviewUserPreparation(source.pk, identities, frozenset(humans))
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from error
        raise


def require_same_review_sources(
    actor: "UploadActor", prepared: ReviewUserPreparation, references: set[UUID]
) -> None:
    from field_sync.exceptions import SyncInProgressError

    current = dict(
        FieldEvent.objects.filter(
            organization=actor.organization, pk__in=references | set(prepared.source_authors)
        ).values_list("pk", "created_by_id")
    )
    source = FieldEvent.objects.get(pk=prepared.source_id)
    if current != prepared.source_authors or not _review_domain_users(source).issubset(
        prepared.humans
    ):
        raise SyncInProgressError


def lock_source_references(ctx: EventContext) -> None:
    from shifts.models import Shift

    identifiers = set()
    if ctx.envelope.type in {"transfer.dispatch", "transfer.receive"}:
        from inventory.transfers.dependencies import source_references as transfer_references
        from inventory.transfers.review import authorize_source

        authorize_source(ctx, ctx.envelope.payload)
        identifiers.update(transfer_references(ctx.organization, ctx.envelope.payload))
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
    if ctx.envelope.type in {"supplies.receive", "supplies.reconcile"}:
        from inventory.allocations.review import authorize_source
        from inventory.allocations.review import source_references as supply_references

        authorize_source(ctx, ctx.envelope.payload)
        identifiers.update(supply_references(ctx))
    require_prepared_source_ids(identifiers)
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
    causal = classify_dependencies(batch, envelope, candidates)
    subjects = subject_facts(batch.organization, envelope)
    with ExitStack() as stack:
        if (
            subjects.resource_kind in {"transfer", "supply_assignment"}
            or envelope.type == "shift.close"
        ):
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
