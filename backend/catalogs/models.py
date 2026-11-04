"""Configurable option lists per organization (decision 5). They are configuration, not records:
items are deactivated instead of deleted, and `OrgScopedModel` already forbids `delete()`."""

from django.db import models
from django.db.models import Q

from core.models import OrgScopedModel

CODE_MAX_LENGTH = 64
LABEL_MAX_LENGTH = 200
ICON_MAX_LENGTH = 64


class Catalog(OrgScopedModel):
    """A list of options (e.g. `removal-reason`). Created by the seed only: there is no POST.

    An open catalog always ends with the fixed "Other (specify)" item.
    """

    slug = models.SlugField(max_length=CODE_MAX_LENGTH)
    label_es = models.CharField(max_length=LABEL_MAX_LENGTH)
    label_en = models.CharField(max_length=LABEL_MAX_LENGTH)
    is_open = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="catalog_unique_slug_per_organization"
            )
        ]

    def __str__(self) -> str:
        return self.slug


class CatalogItem(OrgScopedModel):
    """One option of a catalog. `label_en` may be blank: clients fall back to `label_es`."""

    catalog = models.ForeignKey(Catalog, on_delete=models.PROTECT, related_name="items")
    code = models.SlugField(max_length=CODE_MAX_LENGTH)
    label_es = models.CharField(max_length=LABEL_MAX_LENGTH)
    label_en = models.CharField(max_length=LABEL_MAX_LENGTH, blank=True)
    icon = models.CharField(max_length=ICON_MAX_LENGTH, blank=True)
    sort = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_other = models.BooleanField(default=False)
    requires_photo = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # "Other (specify)" is always last, whatever its `sort`.
        ordering = ["is_other", "sort", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["catalog", "code"], name="item_unique_code_per_catalog"
            ),
            models.UniqueConstraint(
                fields=["catalog"],
                condition=Q(is_other=True),
                name="item_single_other_per_catalog",
            ),
            models.CheckConstraint(
                condition=~Q(is_other=True, is_active=False),
                name="item_other_is_always_active",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.catalog_id}:{self.code}"
