from typing import Any

from rest_framework import serializers

from catalogs.models import Catalog, CatalogItem
from core.serializers import OrgScopedModelSerializer
from shifts.motorcycle_serializers import SnapshotMotorcycleSerializer


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
