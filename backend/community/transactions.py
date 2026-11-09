"""Discover original recipients before accounts, source rows, Organization and courier locks."""

from collections.abc import Iterator
from contextlib import contextmanager

from django.db import DatabaseError, transaction

from accounts.models import User
from community.exceptions import CommunityConflictError
from community.models import CommunityActivity, CommunitySourceLink
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
def community_transaction(
    actor: UploadActor, activity: CommunityActivity | None = None
) -> Iterator[Organization]:
    references = (
        list(
            CommunitySourceLink.objects.filter(
                organization=actor.organization, event__activity=activity, event__action="create"
            ).select_related("source_event__created_by")
        )
        if activity
        else []
    )
    source_ids = {link.source_event_id for link in references}
    recipients = {link.source_event.created_by_id for link in references}
    recipients.discard(None)
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            list(
                User.objects.filter(pk__in={actor.user.pk, *recipients})
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            lock_actor(actor)
            list(
                FieldEvent.objects.filter(organization=actor.organization, pk__in=source_ids)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            organization = Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=actor.organization.pk
            )
            if (
                activity
                and set(
                    CommunitySourceLink.objects.filter(
                        event__activity=activity, event__action="create"
                    ).values_list("source_event_id", flat=True)
                )
                != source_ids
            ):
                raise CommunityConflictError("source_set_changed")
            for user in User.objects.filter(pk__in=recipients).order_by("pk"):
                lock_courier_batches(CourierContext(organization, user))
            yield organization
            check_deferred_constraints_now()
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from error
        raise
