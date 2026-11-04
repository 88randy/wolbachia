from django.db import models

from core.models import OrgScopedModel, VoidableMixin


class Widget(VoidableMixin, OrgScopedModel):
    name = models.CharField(max_length=50)
    related = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
