"""HTTP identity/source preparation precedes the existing retained inventory arbiter."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from uuid import UUID

from django.db import DatabaseError, transaction
from django.http import Http404

from accounts.models import User
from field_sync.models import FieldEvent
from field_sync.services import RETRYABLE_SQLSTATES, set_batch_lock_timeout
from inventory.exceptions import InventoryInProgressError
from inventory.transactions import inventory_transaction
from uploads.access import UploadActor, lock_actor


@contextmanager
def transfer_transaction(actor: UploadActor, references: tuple[UUID, ...] = ()) -> Iterator[Any]:
    """Never take an account/source lock from a locked domain writer or review adapter."""
    sources = list(FieldEvent.objects.filter(organization=actor.organization, pk__in=references))
    if len(sources) != len(set(references)):
        raise Http404
    users = {actor.user.pk, *(row.created_by_id for row in sources if row.created_by_id)}
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            list(
                User.objects.filter(pk__in=users)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            lock_actor(actor)
            list(
                FieldEvent.objects.filter(organization=actor.organization, pk__in=references)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            with inventory_transaction(organization=actor.organization) as organization:
                yield organization
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise InventoryInProgressError from error
        raise
