"""Fleet permissions include the applicable center; unassigned motorcycles require explicit all."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import cast
from uuid import UUID

from django.db import DatabaseError, transaction
from django.http import Http404

from accounts.models import User
from core.exceptions import AlreadyVoidedError
from field_sync.exceptions import SyncInProgressError
from organizations.models import Center, Membership
from organizations.selectors import filter_by_effective_scope
from organizations.services import effective_scope
from shifts.models import Motorcycle


def authorize_motorcycle(motorcycle: Motorcycle, actor: User, permission: str) -> None:
    membership = Membership.objects.filter(
        organization_id=motorcycle.organization_id, user=actor, is_active=True
    ).first()
    if (
        membership is None
        or not filter_by_effective_scope(
            Motorcycle.objects.filter(pk=motorcycle.pk), membership, permission
        ).exists()
    ):
        raise Http404


def authorize_center(
    membership: Membership, identifier: UUID | None, permission: str
) -> Center | None:
    if identifier is None:
        if not any(
            permission in codes and scope["centers"]["mode"] == "all"
            for codes, scope in effective_scope(membership).grants
        ):
            raise Http404
        return None
    center = filter_by_effective_scope(
        Center.objects.filter(organization=membership.organization, pk=identifier),
        membership,
        permission,
    ).first()
    if center is None:
        raise Http404
    return cast(Center, center)


@contextmanager
def lock_motorcycle(motorcycle: Motorcycle) -> Iterator[Motorcycle]:
    """Try the allocation arbiter; never wait behind account/domain writers."""
    try:
        with transaction.atomic():
            locked = Motorcycle.objects.select_for_update(nowait=True).get(pk=motorcycle.pk)
            if locked.voided_at is not None:
                raise AlreadyVoidedError
            yield locked
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in {"55P03", "40P01"}:
            raise SyncInProgressError from error
        raise


@contextmanager
def lock_authorized_motorcycle(
    motorcycle: Motorcycle, actor: User, permission: str
) -> Iterator[Motorcycle]:
    """Recheck the current center and grant after serializing with configuration changes."""
    with lock_motorcycle(motorcycle) as locked:
        authorize_motorcycle(locked, actor, permission)
        yield locked
