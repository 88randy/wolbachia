from catalogs.models import Catalog, CatalogItem
from core.serializers import OrgScopedModelSerializer


class CatalogSerializer(OrgScopedModelSerializer):
    class Meta:
        model = Catalog
        fields = ["slug", "label_es", "label_en", "is_open"]
        read_only_fields = fields


class CatalogItemSerializer(OrgScopedModelSerializer):
    """Read shape of an item. `is_active` and `is_other` change only through their own rules."""

    class Meta:
        model = CatalogItem
        fields = [
            "id",
            "code",
            "label_es",
            "label_en",
            "icon",
            "sort",
            "is_active",
            "is_other",
            "requires_photo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CatalogItemCreateSerializer(OrgScopedModelSerializer):
    """`sort` is optional: an omitted value appends the item at the end of the catalog."""

    class Meta:
        model = CatalogItem
        fields = ["code", "label_es", "label_en", "icon", "sort", "requires_photo"]


class CatalogItemUpdateSerializer(OrgScopedModelSerializer):
    """`code`, `is_other` and `is_active` are not editable here: unknown keys are ignored."""

    class Meta:
        model = CatalogItem
        fields = ["label_es", "label_en", "icon", "sort", "requires_photo"]
