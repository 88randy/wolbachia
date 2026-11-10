"""Discover every affected User before accounts, Organization and courier arbitration."""

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from django.conf import settings
from django.db import DatabaseError, transaction

from accounts.models import User
from field_sync.envelope import CourierContext
from field_sync.exceptions import SyncInProgressError
from field_sync.permissions import FIELD_BOOTSTRAP
from field_sync.services import (
    RETRYABLE_SQLSTATES,
    check_deferred_constraints_now,
    lock_courier_batches,
    set_batch_lock_timeout,
)
from organizations.models import Membership, Organization
from uploads.access import UploadActor, lock_actor


def courier_participants(actor: UploadActor) -> set[UUID]:
    candidates = list(
        Membership.objects.filter(
            organization=actor.organization,
            is_active=True,
            user__is_active=True,
            profiles__organization=actor.organization,
            profiles__is_active=True,
            profiles__permission_codes__contains=[FIELD_BOOTSTRAP],
        )
        .order_by("user_id")
        .values_list("user_id", flat=True)
        .distinct()[: settings.SYNC_MAX_FANOUT_COURIERS + 1]
    )
    if len(candidates) > settings.SYNC_MAX_FANOUT_COURIERS:
        raise SyncInProgressError
    return set(candidates)


@contextmanager
def people_transaction(actor: UploadActor, extra_users: tuple[UUID, ...] = ()) -> Iterator[None]:
    couriers = courier_participants(actor)
    identifiers = couriers | {actor.user.pk, *extra_users}
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            users = list(
                User.objects.filter(pk__in=identifiers)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            lock_actor(actor)
            Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=actor.organization.pk
            )
            if not courier_participants(actor).issubset(couriers):
                raise SyncInProgressError
            for user in users:
                if user.pk in couriers:
                    lock_courier_batches(CourierContext(actor.organization, user))
            yield
            check_deferred_constraints_now()
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from error
        raise


@contextmanager
def people_system_transaction(
    organization: Organization, identifiers: tuple[UUID, ...]
) -> Iterator[None]:
    """Internal notice observation has no invented cookie/device/courier identity."""
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            rows = list(
                User.objects.filter(pk__in=identifiers)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            if len(rows) != len(set(identifiers)):
                raise SyncInProgressError
            Organization.objects.select_for_update(nowait=True, no_key=True).get(pk=organization.pk)
            yield
            check_deferred_constraints_now()
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from error
        raise
