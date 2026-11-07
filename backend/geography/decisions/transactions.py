"""Account/source -> Org NOWAIT -> all courier TRY locks -> geography/domain rows."""

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from uuid import UUID

from django.db import DatabaseError, transaction
from django.http import Http404

from accounts.models import User
from field_sync.envelope import CourierContext
from field_sync.exceptions import SyncInProgressError
from field_sync.models import FieldEvent
from field_sync.services import (
    RETRYABLE_SQLSTATES,
    FanoutScope,
    _fanout_recipients,
    check_deferred_constraints_now,
    lock_courier_batches,
    set_batch_lock_timeout,
)
from geography.decisions.scope import require_contexts
from geography.models import Quadrant
from organizations.models import Organization
from uploads.access import UploadActor, lock_actor


@dataclass(frozen=True)
class WriteScope:
    permission: str
    quadrants: tuple[Quadrant, ...]
    sources: tuple[UUID, ...] = ()
    publish: bool = False
    extra_users: tuple[UUID, ...] = ()


def recipients(spec: WriteScope) -> set[UUID]:
    if not spec.publish:
        return set()
    return {
        row.user.pk
        for quadrant in spec.quadrants
        for row in _fanout_recipients(
            FanoutScope(quadrant.organization, quadrant.center_id, quadrant.pk)
        )
    }


def source_users(actor: UploadActor, spec: WriteScope) -> set[UUID]:
    rows = list(FieldEvent.objects.filter(organization=actor.organization, pk__in=spec.sources))
    if len(rows) != len(set(spec.sources)) or any(row.created_by_id is None for row in rows):
        raise Http404
    return {row.created_by_id for row in rows if row.created_by_id is not None}


def _lock_identity(actor: UploadActor, spec: WriteScope, users: set[UUID]) -> dict[UUID, User]:
    rows = list(
        User.objects.filter(pk__in=users).order_by("pk").select_for_update(nowait=True, no_key=True)
    )
    lock_actor(actor)
    sources = list(
        FieldEvent.objects.filter(organization=actor.organization, pk__in=spec.sources)
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )
    if len(sources) != len(set(spec.sources)):
        raise Http404
    return {row.pk: row for row in rows}


@contextmanager
def geography_transaction(actor: UploadActor, spec: WriteScope) -> Iterator[None]:
    require_contexts(actor, spec.permission, spec.quadrants)
    courier_ids = recipients(spec) | source_users(actor, spec) | set(spec.extra_users)
    planned_users = courier_ids | {actor.user.pk}
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            users = _lock_identity(actor, spec, planned_users)
            Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=actor.organization.pk
            )
            require_contexts(actor, spec.permission, spec.quadrants)
            if not (recipients(spec) | source_users(actor, spec)).issubset(courier_ids):
                raise SyncInProgressError
            for identifier in sorted(courier_ids):
                lock_courier_batches(CourierContext(actor.organization, users[identifier]))
            yield
            check_deferred_constraints_now()
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from error
        raise
