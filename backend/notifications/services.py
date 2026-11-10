"""Append-only inbox writes; membership lock serializes receipts and preference versions."""

from dataclasses import dataclass, field
from uuid import UUID

from django.db import transaction
from django.http import Http404

from core.exceptions import FieldValidationError
from notifications.codes import validate_message
from notifications.models import Notification, NotificationRead, PreferenceVersion
from notifications.permissions import PREFERENCE_UPDATE
from notifications.selectors import inbox_rows, preference_rows, usable_grants
from organizations.models import Membership


@dataclass(frozen=True)
class NotificationDraft:
    recipient: Membership
    code: str = "notification.system"
    params: dict[str, object] = field(default_factory=dict)
    center_id: UUID | None = None
    quadrant_id: UUID | None = None
    object_kind: str = ""
    object_id: UUID | None = None


@transaction.atomic
def publish_notification(draft: NotificationDraft) -> Notification:
    """Internal producer seam only: this records an inbox fact, never email delivery."""
    kind = validate_message(draft.code, draft.params)
    if draft.object_kind not in ("", "incident", "motorcycle", "review_item"):
        raise FieldValidationError("object_kind", "invalid_choice")
    if bool(draft.object_kind) != (draft.object_id is not None):
        raise FieldValidationError("object_id", "invalid_reference")
    recipient = lock_inbox_member(draft.recipient)
    return Notification.objects.create(
        organization_id=recipient.organization_id,
        recipient=recipient,
        kind=kind,
        code=draft.code,
        params=draft.params,
        center_id=draft.center_id,
        quadrant_id=draft.quadrant_id,
        object_kind=draft.object_kind,
        object_id=draft.object_id,
    )


def lock_inbox_member(member: Membership) -> Membership:
    """Serialize all inbox timestamps and first-page cutoffs on the recipient row."""
    locked = (
        Membership.objects.select_for_update(of=("self",))
        .select_related("organization", "user")
        .get(pk=member.pk, user_id=member.user_id, organization_id=member.organization_id)
    )
    if not locked.is_active or not locked.user.is_active or not locked.organization.is_active:
        raise Http404
    return locked


def _append_read(member: Membership, row: Notification) -> None:
    NotificationRead.objects.get_or_create(
        notification=row,
        defaults={"organization_id": member.organization_id, "created_by": member.user},
    )


@transaction.atomic
def mark_read(member: Membership, identifier: UUID) -> None:
    """Idempotent receipt: its first timestamp never moves on retries."""
    locked = lock_inbox_member(member)
    row = inbox_rows(locked).filter(pk=identifier).first()
    if row is None:
        raise Http404
    _append_read(locked, row)


@transaction.atomic
def mark_all_read(member: Membership) -> None:
    """Read only this owner's currently visible rows; future arrivals remain unread."""
    locked = lock_inbox_member(member)
    for row in inbox_rows(locked).filter(read_at__isnull=True).iterator():
        _append_read(locked, row)


@transaction.atomic
def update_preferences(member: Membership, changes: list[dict[str, object]]) -> None:
    """Validate the whole patch before appending any version; no partial policy writes."""
    locked = lock_inbox_member(member)
    usable_grants(locked, PREFERENCE_UPDATE)
    current = {row["kind"]: row for row in preference_rows(locked)}
    for change in changes:
        kind = str(change["kind"])
        merged = current[kind] | change
        if kind == "critical" and (not merged["in_app"] or not merged["email"]):
            raise FieldValidationError("preferences", "required_channel")
    for change in changes:
        _append_preference(locked, current[str(change["kind"])], change)


def _append_preference(
    member: Membership, current: dict[str, object], change: dict[str, object]
) -> None:
    kind = str(change["kind"])
    in_app, email = (
        bool(change.get("in_app", current["in_app"])),
        bool(change.get("email", current["email"])),
    )
    if in_app == current["in_app"] and email == current["email"]:
        return
    last = (
        PreferenceVersion.objects.filter(recipient=member, kind=kind).order_by("-revision").first()
    )
    PreferenceVersion.objects.create(
        organization_id=member.organization_id,
        recipient=member,
        created_by=member.user,
        kind=kind,
        in_app=in_app,
        email=email,
        revision=1 if last is None else last.revision + 1,
    )
