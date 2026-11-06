"""Account → Organization commits, with deferred checks inside the 429 mapper."""

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from django.db import DatabaseError, transaction

from field_sync.models import FieldEvent
from field_sync.services import (
    RETRYABLE_SQLSTATES,
    check_deferred_constraints_now,
    set_batch_lock_timeout,
)
from incidents.exceptions import IncidentInProgressError
from organizations.models import Organization
from uploads.access import UploadActor, lock_actor


@contextmanager
def incident_transaction(
    actor: UploadActor | None,
    organization: Organization | None = None,
    source_event_id: UUID | None = None,
) -> Iterator[None]:
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            if actor:
                lock_actor(actor)
                organization = actor.organization
            if organization is None:
                raise ValueError("An organization is required for an incident transaction.")
            if source_event_id is not None:
                FieldEvent.objects.select_for_update(nowait=True, no_key=True).get(
                    organization=organization, pk=source_event_id
                )
            Organization.objects.select_for_update(nowait=True, no_key=True).get(pk=organization.pk)
            yield
            check_deferred_constraints_now()
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise IncidentInProgressError from error
        raise
