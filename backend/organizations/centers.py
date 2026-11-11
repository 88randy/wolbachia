"""Center lifecycle: create, rename, deactivate and reactivate (writes Center and the audit).

Shared by the organization admin API and the platform provisioning wizard. Nothing is deleted:
deactivating keeps the row, records who, when and why, and appends a `PlatformAuditEntry`.
Deactivation is refused while the center still has active work (see `center_closure`).
"""

import re
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any

from django.db import DatabaseError, IntegrityError, transaction

from accounts.models import User
from core.exceptions import DomainError, FieldValidationError
from core.time import server_now
from organizations.exceptions import AdministrationBusyError
from organizations.models import Center, Membership, Organization
from organizations.services import effective_scope
from platform_admin.models import PlatformAuditEntry

CENTER_CODE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$")
CENTER_CREATE = "center.create"
CENTER_UPDATE = "center.update"
CENTER_DEACTIVATE = "center.deactivate"
Action = PlatformAuditEntry.Action


class CenterScopeLimitedError(DomainError):
    """A center can only be created by a grant that covers every center of the organization."""

    code = "center_scope_limited"
    status_code = HTTPStatus.FORBIDDEN
    default_detail = "Creating a center needs center.create over all centers."


class CenterStateConflictError(DomainError):
    code = "center_state_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The center is not in the expected active state."


class CenterBusyError(DomainError):
    """Deactivation refused: `blocked_by` lists each kind of active work and its count."""

    code = "center_has_active_work"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The center still has active work."

    def __init__(self, blockers: list[dict[str, Any]]) -> None:
        super().__init__()
        self.blocked_by = blockers


@dataclass(frozen=True)
class CenterSpec:
    code: str
    name: str


def _audit(  # noqa: PLR0913 -- one audit receipt: action, actor, center, details
    action: str, actor: User | None, center: Center, details: dict[str, Any]
) -> None:
    PlatformAuditEntry.objects.create(
        action=action,
        actor=actor,
        organization_id=center.organization_id,
        target_id=center.pk,
        details={"code": center.code, **details},
    )


RETRYABLE_LOCK_SQLSTATES = frozenset({"55P03", "40P01"})


def _lock_center(center: Center) -> Center:
    """Try-lock the center row inside the caller's transaction; never wait (429 when busy).

    NO KEY UPDATE leaves foreign-key checks (motorcycle moves) unblocked, and still conflicts
    with the shared lock `shift.open` takes on the center of its motorcycle.
    """
    try:
        return Center.objects.select_for_update(nowait=True, no_key=True).get(pk=center.pk)
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_LOCK_SQLSTATES:
            raise AdministrationBusyError from error
        raise


def require_all_centers_grant(membership: Membership) -> None:
    """A limited center scope cannot create a center: it would sit outside that scope."""
    grants = effective_scope(membership).grants
    if not any(
        CENTER_CREATE in codes and scope["centers"]["mode"] == "all" for codes, scope in grants
    ):
        raise CenterScopeLimitedError


def validate_center_code(code: str) -> None:
    if not CENTER_CODE_PATTERN.fullmatch(code):
        raise FieldValidationError("code", "invalid_code")


def create_center(organization: Organization, spec: CenterSpec, actor: User | None) -> Center:
    """Insert one center and its audit. The code is unique per organization, ignoring case."""
    validate_center_code(spec.code)
    if not spec.name.strip():
        raise FieldValidationError("name", "required")
    if Center.objects.filter(organization=organization, code__iexact=spec.code).exists():
        raise FieldValidationError("code", "center_code_taken")
    try:
        with transaction.atomic():
            center = Center.objects.create(
                organization=organization,
                code=spec.code,
                name=spec.name.strip(),
                created_by=actor,
            )
    except IntegrityError as error:
        raise FieldValidationError("code", "center_code_taken") from error
    _audit(Action.CENTER_CREATE, actor, center, {"name": center.name})
    return center


def rename_center(center: Center, name: str, actor: User) -> Center:
    """Change the name only; the code is immutable once created."""
    if not name.strip():
        raise FieldValidationError("name", "required")
    with transaction.atomic():
        locked = _lock_center(center)
        previous = locked.name
        locked.name = name.strip()
        locked.save(update_fields=["name", "updated_at"])
        _audit(Action.CENTER_UPDATE, actor, locked, {"name": locked.name, "previous": previous})
    return locked


def deactivate_center(center: Center, reason: str, actor: User) -> Center:
    """Deactivate under the center row lock, after proving it has no active work."""
    from organizations.center_closure import closure_blockers

    with transaction.atomic():
        locked = _lock_center(center)
        if not locked.is_active:
            raise CenterStateConflictError
        blockers = closure_blockers(locked)
        if blockers:
            raise CenterBusyError(blockers)
        locked.is_active = False
        locked.deactivated_at = server_now()
        locked.deactivated_by = actor
        locked.deactivated_reason = reason
        locked.save(
            update_fields=[
                "is_active",
                "deactivated_at",
                "deactivated_by",
                "deactivated_reason",
                "updated_at",
            ]
        )
        _audit(Action.CENTER_DEACTIVATE, actor, locked, {"reason": reason})
    return locked


def reactivate_center(center: Center, actor: User) -> Center:
    """Reactivate; the previous deactivation stays in the audit log."""
    with transaction.atomic():
        locked = _lock_center(center)
        if locked.is_active:
            raise CenterStateConflictError
        locked.is_active = True
        locked.deactivated_at = None
        locked.deactivated_by = None
        locked.deactivated_reason = ""
        locked.save(
            update_fields=[
                "is_active",
                "deactivated_at",
                "deactivated_by",
                "deactivated_reason",
                "updated_at",
            ]
        )
        _audit(Action.CENTER_REACTIVATE, actor, locked, {})
    return locked
