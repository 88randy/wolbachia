from django.db import models

from core.filters import CODE_MAX_LENGTH
from core.models import OrgScopedModel, VoidableMixin


class Widget(VoidableMixin, OrgScopedModel):
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=CODE_MAX_LENGTH, blank=True, default="")
    related = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
