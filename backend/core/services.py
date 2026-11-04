from typing import cast

from django.db import models, transaction
from django.utils import timezone

from accounts.models import User
from core.exceptions import AlreadyVoidedError
from core.models import VoidableMixin


def void_record[VoidableT: VoidableMixin](
    instance: VoidableT, user: User, reason: str
) -> VoidableT:
    """Void a record (writes: voided_at, voided_by, void_reason). Never deletes anything.

    The row is locked so two concurrent voids cannot both succeed; the second one gets
    `AlreadyVoidedError` (409).
    """
    with transaction.atomic():
        locked = cast(
            VoidableT, type(instance)._default_manager.select_for_update().get(pk=instance.pk)
        )
        if locked.voided_at is not None:
            raise AlreadyVoidedError
        locked.voided_at = timezone.now()
        locked.voided_by = user
        locked.void_reason = reason
        locked.save(update_fields=["voided_at", "voided_by", "void_reason"])
    return locked


def lock_record_for_update(instance: models.Model) -> None:
    """Lock the row until the surrounding transaction ends and reload the instance.

    Call it inside `transaction.atomic()` before saving a PATCH/PUT: it makes the update see a
    void committed after the request read the record, and refuses to update voided records
    (`AlreadyVoidedError`, 409). Reloading means the save never writes stale void fields.
    """
    locked = type(instance)._default_manager.select_for_update().get(pk=instance.pk)
    if isinstance(locked, VoidableMixin) and locked.voided_at is not None:
        raise AlreadyVoidedError
    instance.refresh_from_db()
