"""One cross-domain arbiter; no account locks may be acquired below it."""

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from uuid import UUID

from django.db import DatabaseError, transaction

from field_sync.services import (
    RETRYABLE_SQLSTATES,
    check_deferred_constraints_now,
    set_batch_lock_timeout,
)
from inventory.exceptions import InventoryInProgressError
from organizations.models import Organization
from uploads.access import UploadActor, lock_actor

_locked_organization: ContextVar[UUID | None] = ContextVar("inventory_organization", default=None)


def require_inventory_lock(organization_id: UUID) -> None:
    if _locked_organization.get() != organization_id:
        raise RuntimeError("Inventory effects and dispatch checks require the shared arbiter.")


@contextmanager
def inventory_transaction(
    actor: UploadActor | None = None, organization: Organization | None = None
) -> Iterator[Organization]:
    """Yield the locked configuration after identity refresh; flush deferred checks here."""
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            if actor is not None:
                lock_actor(actor)
                organization = actor.organization
            if organization is None:
                raise ValueError("An organization is required.")
            organization = Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=organization.pk
            )
            token = _locked_organization.set(organization.pk)
            try:
                yield organization
                check_deferred_constraints_now()
            finally:
                _locked_organization.reset(token)
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise InventoryInProgressError from error
        raise
