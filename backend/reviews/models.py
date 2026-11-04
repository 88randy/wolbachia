"""Review items: what a supervisor must look at because the server did not simply accept an event.

A `ReviewItem` is created together with every rejected or in-review `FieldEvent` (same
savepoint) and is never modified. Decisions (accept, void, open an incident) are new insert-only
rows added by #22.
"""

from django.conf import settings
from django.db import models

from core.models import ImmutableMixin, OrgScopedModel

CODE_MAX_LENGTH = 64
KIND_MAX_LENGTH = 20
EVENT_TYPE_MAX_LENGTH = 64


class ReviewKind(models.TextChoices):
    REJECTED = "rejected"
    IN_REVIEW = "in_review"


class ReviewItem(ImmutableMixin, OrgScopedModel):
    """Insert-only (a PostgreSQL trigger in the migration also blocks UPDATE and DELETE).

    `code` and `params` are the machine reason (never user-facing text). `event_type` is copied
    so the list can show it without joining the event. `courier` is the user that sent the event.

    `courier_sequence` is the position of the item in its courier's inbox: 1, 2, 3... per
    (organization, courier), assigned by `reviews.services.create_review_item` as `max + 1` while the
    caller holds the courier's batch lock (`field_sync.services.lock_courier_batches`). The `changes`
    cursor paginates by it, never by time, so a clock that goes back or two items created in the
    same instant cannot make the phone skip one. The unique constraint is the backstop for a writer
    that forgot the lock.
    """

    field_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="review_item"
    )
    kind = models.CharField(max_length=KIND_MAX_LENGTH, choices=ReviewKind.choices)
    code = models.CharField(max_length=CODE_MAX_LENGTH)
    params = models.JSONField(default=dict)
    event_type = models.CharField(max_length=EVENT_TYPE_MAX_LENGTH)
    courier_sequence = models.BigIntegerField()
    courier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    device = models.ForeignKey("accounts.Device", on_delete=models.PROTECT, related_name="+")

    class Meta(ImmutableMixin.Meta):
        indexes = [
            models.Index(fields=["organization", "created_at", "id"]),
            models.Index(fields=["organization", "kind", "code"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "courier", "courier_sequence"],
                name="reviews_reviewitem_unique_courier_sequence",
            )
        ]

    def __str__(self) -> str:
        return f"{self.kind}:{self.code}"
