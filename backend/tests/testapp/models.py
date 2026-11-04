from django.db import models

from core.models import OrgScopedModel, VoidableMixin


class Widget(VoidableMixin, OrgScopedModel):
    name = models.CharField(max_length=50)
