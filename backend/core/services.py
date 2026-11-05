from typing import cast

from django.db import models, transaction
from django.utils import timezone

from accounts.models import User
from core.exceptions import AlreadyVoidedError
from core.models import VoidableMixin
from core.void_reason import ResolvedVoidReason, resolve_void_reason


def void_record[VoidableT: VoidableMixin](  # noqa: PLR0913 -- explicit public void contract
    instance: VoidableT, user: User, reason: str, reason_code: str
) -> VoidableT:
    """Resolve the organization's catalog choice and void the record; never delete it."""
    choice = resolve_void_reason(instance.organization_id, reason, reason_code)  # type: ignore[attr-defined]
    return void_validated_record(instance, user, choice)


def void_validated_record[VoidableT: VoidableMixin](
    instance: VoidableT, user: User, choice: ResolvedVoidReason
) -> VoidableT:
    """Write a choice returned by the resolver without repeating its catalog query.

    Callers resolve against the target's organization first (a lock-free read, see the resolver).
    Inactive sync choices are for review only.
    The row lock arbitrates concurrent voids; all four fields are saved together.
    """
    if not choice.is_active or choice.organization_id != instance.organization_id:  # type: ignore[attr-defined]
        raise ValueError("A void requires an active choice from the target's organization.")
    with transaction.atomic():
        locked = cast(
            VoidableT, type(instance)._default_manager.select_for_update().get(pk=instance.pk)
        )
        if locked.voided_at is not None:
            raise AlreadyVoidedError
        locked.voided_at = timezone.now()
        locked.voided_by = user
        locked.void_reason = choice.reason
        locked.void_reason_code = choice.code
        locked.save(update_fields=["voided_at", "voided_by", "void_reason", "void_reason_code"])
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
