"""Authentic participants and known sources precede the retained inventory arbiter."""

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import DatabaseError, transaction
from django.http import Http404

from accounts.models import User
from field_sync.envelope import CourierContext
from field_sync.models import FieldEvent
from field_sync.services import (
    RETRYABLE_SQLSTATES,
    advisory_key,
    lock_courier_batches,
    set_batch_lock_timeout,
)
from inventory.exceptions import InventoryInProgressError
from inventory.transactions import inventory_transaction
from organizations.models import Organization
from uploads.access import UploadActor, lock_actor


@dataclass(frozen=True)
class SupplyParticipants:
    users: tuple[UUID, ...] = ()
    sources: tuple[UUID, ...] = ()
    couriers: tuple[UUID, ...] = ()


NO_PARTICIPANTS = SupplyParticipants()


def assignment_participants(assignment: Any) -> SupplyParticipants:  # noqa: ANN401 -- real immutable SupplyAssignment
    from inventory.allocations.models import (
        InventoryIntentExecution,
        OriginReleaseProof,
        ReconciliationVersion,
        ReleaseCancellation,
        ReturnAcceptance,
        SupplyAssignmentVersion,
        SupplyDiscrepancyDecision,
        SupplyEvent,
        SupplySourceLink,
        SupplyVoidSourceLink,
    )

    users = {assignment.courier_id, assignment.created_by_id}
    owners = (
        (SupplyAssignmentVersion, {"assignment": assignment}),
        (OriginReleaseProof, {"version__assignment": assignment}),
        (ReleaseCancellation, {"release__version__assignment": assignment}),
        (SupplyEvent, {"assignment": assignment}),
        (ReturnAcceptance, {"declaration__event__assignment": assignment}),
        (SupplyDiscrepancyDecision, {"discrepancy__reconciliation__assignment": assignment}),
        (InventoryIntentExecution, {"intent__assignment": assignment}),
    )
    for model, lookup in owners:
        users.update(
            model.objects.filter(organization=assignment.organization, **lookup)
            .values_list("created_by_id", flat=True)
            .distinct()
        )
    sources = set(
        SupplySourceLink.objects.filter(event__assignment=assignment).values_list(
            "source_event_id", flat=True
        )
    )
    sources.update(
        SupplyVoidSourceLink.objects.filter(audit__event__assignment=assignment).values_list(
            "source_event_id", flat=True
        )
    )
    sources.update(
        ReconciliationVersion.objects.filter(
            reconciliation__assignment=assignment, close_source_uuid__isnull=False
        ).values_list("close_source_uuid", flat=True)
    )
    if assignment.shift_id is not None:
        sources.add(assignment.shift.opened_event_id)
        if assignment.shift.closed_event_id is not None:
            sources.add(assignment.shift.closed_event_id)
    authors = dict(
        FieldEvent.objects.filter(organization=assignment.organization, pk__in=sources).values_list(
            "pk", "created_by_id"
        )
    )
    if set(authors) != sources:
        raise InventoryInProgressError
    users.update(authors.values())
    if None in users:
        raise InventoryInProgressError
    return SupplyParticipants(
        users=tuple(sorted(users)),
        sources=tuple(sorted(sources)),
        couriers=(assignment.courier_id,),
    )


@contextmanager
def supply_transaction(
    actor: UploadActor, participants: SupplyParticipants = NO_PARTICIPANTS
) -> Iterator[Organization]:
    """No participant can first be discovered beneath Organization or courier locks."""
    sources = list(
        FieldEvent.objects.filter(organization=actor.organization, pk__in=participants.sources)
    )
    if len(sources) != len(set(participants.sources)):
        raise Http404
    users = {
        actor.user.pk,
        *participants.users,
        *participants.couriers,
        *(row.created_by_id for row in sources),
    }
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            locked = list(
                User.objects.filter(pk__in=users)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            if len(locked) != len(users):
                raise Http404
            lock_actor(actor)
            list(
                FieldEvent.objects.filter(
                    organization=actor.organization, pk__in=participants.sources
                )
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            with inventory_transaction(organization=actor.organization) as organization:
                for identifier in sorted(
                    participants.couriers,
                    key=lambda value: advisory_key("courier", organization.pk, value),
                ):
                    courier = next(row for row in locked if row.pk == identifier)
                    lock_courier_batches(CourierContext(organization, courier))
                yield organization
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise InventoryInProgressError from error
        raise
