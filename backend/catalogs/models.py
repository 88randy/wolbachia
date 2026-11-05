"""Configurable option lists per organization (decision 5). They are configuration, not records:
items are deactivated instead of deleted, and `OrgScopedModel` already forbids `delete()`."""

from django.core.validators import MaxValueValidator, RegexValidator
from django.db import models
from django.db.models import Q

from core.models import OTHER_ITEM_CODE as OTHER_ITEM_CODE
from core.models import ImmutableMixin, OrgScopedModel

CODE_MAX_LENGTH = 64
LABEL_MAX_LENGTH = 200
ICON_MAX_LENGTH = 64
# The sort of an item is bounded so `max + 1` can never overflow the column.
MAX_SORT = 10_000

validate_item_code = RegexValidator(
    r"^[a-z0-9][a-z0-9_-]*$", "Use lowercase letters, digits, hyphens and underscores."
)
validate_icon = RegexValidator(r"^[a-z0-9-]+$", "Use lowercase letters, digits and hyphens.")


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
    code = models.CharField(max_length=CODE_MAX_LENGTH, validators=[validate_item_code])
    label_es = models.CharField(max_length=LABEL_MAX_LENGTH)
    label_en = models.CharField(max_length=LABEL_MAX_LENGTH, blank=True)
    icon = models.CharField(max_length=ICON_MAX_LENGTH, blank=True, validators=[validate_icon])
    sort = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(MAX_SORT)])
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


class CatalogSnapshot(ImmutableMixin, OrgScopedModel):
    """Exact configuration delivered to a phone, retained by organization/hash for offline ingest."""

    version = models.CharField(max_length=64)
    content = models.JSONField()

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "version"], name="catalog_snapshot_org_version"
            )
        ]
