"""Review items: what a supervisor must look at because the server did not simply accept an event.

A `ReviewItem` is created together with every rejected or in-review `FieldEvent` (same
savepoint) and is never modified. Decisions (accept, void, open an incident) are new insert-only
rows added by #22.
"""

from django.conf import settings
from django.db import models

from core.models import ImmutableMixin, OrgScopedModel

CODE_MAX_LENGTH = 64
EVENT_TYPE_MAX_LENGTH = 64


class ReviewKind(models.TextChoices):
    REJECTED = "rejected"
    IN_REVIEW = "in_review"


class ReviewItem(ImmutableMixin, OrgScopedModel):
    """Insert-only (a PostgreSQL trigger in the migration also blocks UPDATE and DELETE).

    `code` and `params` are the machine reason (never user-facing text). `event_type` is copied
    so the list can show it without joining the event. `courier` is the user that sent the event.
    """

    field_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="review_item"
    )
    kind = models.CharField(max_length=20, choices=ReviewKind.choices)
    code = models.CharField(max_length=CODE_MAX_LENGTH)
    params = models.JSONField(default=dict)
    event_type = models.CharField(max_length=EVENT_TYPE_MAX_LENGTH)
    courier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    device = models.ForeignKey("accounts.Device", on_delete=models.PROTECT, related_name="+")

    class Meta(ImmutableMixin.Meta):
        indexes = [
            models.Index(fields=["organization", "created_at", "id"]),
            models.Index(fields=["organization", "courier", "created_at", "id"]),
            models.Index(fields=["organization", "kind", "code"]),
        ]

    def __str__(self) -> str:
        return f"{self.kind}:{self.code}"
