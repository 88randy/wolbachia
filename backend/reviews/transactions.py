"""Fresh actor -> sorted source rows -> Organization -> courier TRY -> domain -> uploads."""

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from django.db import DatabaseError, transaction

from accounts.models import User
from field_sync.envelope import CourierContext
from field_sync.exceptions import SyncInProgressError
from field_sync.models import FieldEvent
from field_sync.services import (
    RETRYABLE_SQLSTATES,
    check_deferred_constraints_now,
    lock_courier_batches,
    set_batch_lock_timeout,
)
from organizations.models import Organization
from uploads.access import UploadActor, lock_actor


@contextmanager
def review_transaction(
    actor: UploadActor, source: FieldEvent, references: set[UUID]
) -> Iterator[FieldEvent]:
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            courier = source.created_by or source.review_item.courier
            # Effects and CourierChange retain the original author. Lock BOTH users
            # in order before any device/session row, without reauthenticating that
            # historical author or imposing their present-day business grants.
            list(
                User.objects.filter(pk__in={actor.user.pk, courier.pk})
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            lock_actor(actor)
            rows = list(
                FieldEvent.objects.filter(
                    organization=actor.organization, pk__in=references | {source.pk}
                )
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            locked = next(row for row in rows if row.pk == source.pk)
            Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=actor.organization.pk
            )
            courier = locked.created_by or locked.review_item.courier
            lock_courier_batches(CourierContext(actor.organization, courier))
            yield locked
            check_deferred_constraints_now()
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from error
        raise
