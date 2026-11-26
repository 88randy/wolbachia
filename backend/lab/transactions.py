"""Identity/source locks precede the Organization arbiter; domain and uploads follow."""

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from uuid import UUID

from django.db import DatabaseError, transaction

from accounts.models import User
from field_sync.envelope import CourierContext
from field_sync.models import FieldEvent
from field_sync.services import (
    RETRYABLE_SQLSTATES,
    check_deferred_constraints_now,
    lock_courier_batches,
    set_batch_lock_timeout,
)
from lab.access import PreparedLabSubject
from lab.exceptions import LabInProgressError
from organizations.models import Organization
from uploads.access import UploadActor, lock_actor

_locked_organization: ContextVar[UUID | None] = ContextVar("lab_organization", default=None)
_prepared_collectors: ContextVar[frozenset[UUID]] = ContextVar(
    "lab_collectors", default=frozenset()
)
_prepared_users: ContextVar[frozenset[UUID]] = ContextVar("lab_users", default=frozenset())


@dataclass(frozen=True)
class LabParticipants:
    users: tuple[UUID, ...] = ()
    sources: tuple[tuple[UUID, UUID], ...] = ()


EMPTY_PARTICIPANTS = LabParticipants()


def require_lab_lock(organization_id: UUID) -> None:
    if _locked_organization.get() != organization_id:
        raise RuntimeError("Lab effects require the retained Organization arbiter")


def require_prepared_collector(identifier: UUID) -> None:
    if identifier not in _prepared_collectors.get():
        raise RuntimeError("A history recipient must be prepared and locked before Organization")


def require_prepared_author(identifier: UUID | None) -> None:
    if identifier is None:
        raise RuntimeError("A human history fact requires an authentic author")
    if identifier not in _prepared_users.get():
        raise LabInProgressError


def lock_users(identifiers: set[UUID], *, nowait: bool = True) -> list[User]:
    rows = list(
        User.objects.filter(pk__in=identifiers)
        .order_by("pk")
        .select_for_update(nowait=nowait, no_key=True)
    )
    if len(rows) != len(identifiers):
        raise LabInProgressError
    return rows


def lock_sources(organization: Organization, identities: dict[UUID, UUID]) -> None:
    rows = list(
        FieldEvent.objects.filter(organization=organization, pk__in=identities)
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )
    if len(rows) != len(identities) or any(row.created_by_id != identities[row.pk] for row in rows):
        raise LabInProgressError


def lock_collectors(organization: Organization, users: list[User], identifiers: set[UUID]) -> None:
    for user in users:
        if user.pk in identifiers:
            lock_courier_batches(CourierContext(organization, user))


@contextmanager
def mapped_transaction() -> Iterator[None]:
    try:
        with transaction.atomic():
            set_batch_lock_timeout()
            yield
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise LabInProgressError from error
        raise


@contextmanager
def publication_context(
    organization: Organization, collectors: set[UUID], users: set[UUID]
) -> Iterator[None]:
    token = _locked_organization.set(organization.pk)
    collector_token = _prepared_collectors.set(frozenset(collectors))
    user_token = _prepared_users.set(frozenset(users))
    try:
        yield
        check_deferred_constraints_now()
    finally:
        _prepared_collectors.reset(collector_token)
        _prepared_users.reset(user_token)
        _locked_organization.reset(token)


@contextmanager
def lab_transaction(
    actor: UploadActor,
    prepared: tuple[PreparedLabSubject, ...] = (),
    extra: LabParticipants = EMPTY_PARTICIPANTS,
) -> Iterator[Organization]:
    collectors = {subject.collector_id for subject in prepared} | {
        user for _, user in extra.sources
    }
    participants = {
        actor.user.pk,
        *collectors,
        *(author for subject in prepared for author in subject.author_ids),
        *extra.users,
    }
    sources = {subject.source_id: subject.collector_id for subject in prepared}
    sources.update(extra.sources)
    with mapped_transaction():
        users = lock_users(participants)
        lock_actor(actor)
        lock_sources(actor.organization, sources)
        organization = Organization.objects.select_for_update(nowait=True, no_key=True).get(
            pk=actor.organization.pk
        )
        lock_collectors(organization, users, collectors)
        with publication_context(organization, collectors, participants):
            yield organization


@contextmanager
def lab_system_transaction(
    organization: Organization, prepared: tuple[PreparedLabSubject, ...]
) -> Iterator[Organization]:
    """System policy uses real preidentified sources, never a counterfeit human actor."""
    collectors = {subject.collector_id for subject in prepared}
    participants = {*collectors, *(author for subject in prepared for author in subject.author_ids)}
    sources = {subject.source_id: subject.collector_id for subject in prepared}
    with mapped_transaction():
        users = lock_users(participants)
        lock_sources(organization, sources)
        locked = Organization.objects.select_for_update(nowait=True, no_key=True).get(
            pk=organization.pk, is_active=True
        )
        lock_collectors(locked, users, collectors)
        with publication_context(locked, collectors, participants):
            yield locked
