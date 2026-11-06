"""Every review audit is human-authored and insert-only."""

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel


class ReviewAudit(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=models.Q(created_by__isnull=False), name="%(app_label)s_%(class)s_author"
            )
        ]
