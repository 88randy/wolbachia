from typing import Any

from rest_framework import serializers

from catalogs.models import Catalog, CatalogItem
from core.serializers import OrgScopedModelSerializer
from shifts.motorcycle_serializers import SnapshotMotorcycleSerializer


class CatalogSerializer(OrgScopedModelSerializer):
    version = serializers.IntegerField(source="revision", read_only=True)

    class Meta:
        model = Catalog
        fields = ["slug", "label_es", "label_en", "is_open", "version"]
        read_only_fields = fields


class CatalogItemFilterSerializer(serializers.Serializer[Any]):
    is_active = serializers.ChoiceField(choices=["true", "false"], required=False)


class CatalogItemSerializer(OrgScopedModelSerializer):
    """Read shape of an item. `is_active` and `is_other` change only through their own rules."""

    protected = serializers.BooleanField(source="is_other", read_only=True)
    in_use = serializers.SerializerMethodField()
    usage_count = serializers.SerializerMethodField()
    catalog_version = serializers.IntegerField(source="catalog.revision", read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, allow_null=True, default=None
    )
    deactivated_by_username = serializers.CharField(
        source="deactivated_by.username", read_only=True, allow_null=True, default=None
    )

    def get_in_use(self, item: CatalogItem) -> bool:
        return self.get_usage_count(item) > 0

    def get_usage_count(self, item: CatalogItem) -> int:
        from catalogs.selectors import catalog_item_usage_count

        return catalog_item_usage_count(item)

    class Meta:
        model = CatalogItem
        fields = [
            "protected",
            "in_use",
            "usage_count",
            "catalog_version",
            "created_by",
            "created_by_username",
            "deactivated_at",
            "deactivated_by",
            "deactivated_by_username",
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


class CatalogReorderSerializer(serializers.Serializer[Any]):
    version = serializers.IntegerField(min_value=0)
    ordered_ids = serializers.ListField(child=serializers.UUIDField(), max_length=200)


class CatalogReorderResponseSerializer(serializers.Serializer[Any]):
    version = serializers.IntegerField(read_only=True)
    items = CatalogItemSerializer(many=True, read_only=True)


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


class SnapshotItemSerializer(serializers.Serializer[Any]):
    """Documents the field snapshot (the payload is built by `build_catalog_snapshot`)."""

    id = serializers.UUIDField()
    code = serializers.CharField()
    label_es = serializers.CharField()
    label_en = serializers.CharField(help_text="Blank: fall back to `label_es`.")
    icon = serializers.CharField()
    sort = serializers.IntegerField()
    is_other = serializers.BooleanField()
    requires_photo = serializers.BooleanField()


class SnapshotCatalogSerializer(serializers.Serializer[Any]):
    slug = serializers.SlugField()
    label_es = serializers.CharField()
    label_en = serializers.CharField()
    is_open = serializers.BooleanField()
    items = SnapshotItemSerializer(many=True)


class CatalogSnapshotSerializer(serializers.Serializer[Any]):
    """Every catalog with its active items. `version` is also the `ETag`."""

    version = serializers.CharField()
    catalogs = SnapshotCatalogSerializer(many=True)
    motorcycles = SnapshotMotorcycleSerializer(many=True)
