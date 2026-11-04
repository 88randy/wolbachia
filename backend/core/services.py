from typing import cast

from django.db import models, transaction
from django.utils import timezone

from accounts.models import User
from core.exceptions import AlreadyVoidedError
from core.models import VoidableMixin
from core.void_reason import validate_void_reason


def void_record[VoidableT: VoidableMixin](
    instance: VoidableT, user: User, reason: str
) -> VoidableT:
    """Void a record (writes: voided_at, voided_by, void_reason). Never deletes anything.

    The row is locked so two concurrent voids cannot both succeed; the second one gets
    `AlreadyVoidedError` (409). The reason goes through `validate_void_reason` (trimmed, minimum
    length), so no caller can store a shorter one: `FieldValidationError` (400).
    """
    cleaned_reason = validate_void_reason(reason)
    with transaction.atomic():
        locked = cast(
            VoidableT, type(instance)._default_manager.select_for_update().get(pk=instance.pk)
        )
        if locked.voided_at is not None:
            raise AlreadyVoidedError
        locked.voided_at = timezone.now()
        locked.voided_by = user
        locked.void_reason = cleaned_reason
        locked.save(update_fields=["voided_at", "voided_by", "void_reason"])
    return locked


def lock_record_for_update[ModelT: models.Model](instance: ModelT) -> ModelT:
    """Lock the row until the surrounding transaction ends and return the fresh instance.

    Call it inside `transaction.atomic()` before saving a PATCH/PUT: it makes the update see a
    void committed after the request read the record, and refuses to update voided records
    (`AlreadyVoidedError`, 409). Saving the returned instance never writes stale void fields.
    """
    locked = cast(ModelT, type(instance)._default_manager.select_for_update().get(pk=instance.pk))
    if isinstance(locked, VoidableMixin) and locked.voided_at is not None:
        raise AlreadyVoidedError
    return locked
