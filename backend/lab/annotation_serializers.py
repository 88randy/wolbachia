"""Closed pixel mark contract; live image bounds belong to the count writer."""

from typing import Any

from drf_spectacular.extensions import OpenApiSerializerExtension
from rest_framework import serializers

from ovitraps.payloads import StrictPayloadSerializer

MAX_ANNOTATION_MARKS = 5000


class PixelIntegerField(serializers.IntegerField):
    def to_internal_value(self, value: Any) -> int:  # noqa: ANN401 -- DRF boundary
        if type(value) is not int:
            self.fail("invalid")
        return int(super().to_internal_value(value))


class EggPointMarkSerializer(StrictPayloadSerializer):
    kind = serializers.ChoiceField(choices=["point"])
    x = PixelIntegerField(min_value=0)
    y = PixelIntegerField(min_value=0)


class EggBoxMarkSerializer(StrictPayloadSerializer):
    kind = serializers.ChoiceField(choices=["box"])
    x = PixelIntegerField(min_value=0)
    y = PixelIntegerField(min_value=0)
    w = PixelIntegerField(min_value=1)
    h = PixelIntegerField(min_value=1)


class EggMarkSerializer(StrictPayloadSerializer):
    def to_internal_value(self, value: Any) -> dict[str, Any]:  # noqa: ANN401 -- DRF boundary
        if not isinstance(value, dict) or value.get("kind") not in ("box", "point"):
            raise serializers.ValidationError({"kind": ["invalid_choice"]})
        owner = EggBoxMarkSerializer if value["kind"] == "box" else EggPointMarkSerializer
        parsed = owner(data=value)
        parsed.is_valid(raise_exception=True)
        return dict(parsed.validated_data)


class EggMarkSchema(OpenApiSerializerExtension):  # type: ignore[no-untyped-call]
    target_class = EggMarkSerializer

    def map_serializer(self, auto_schema: Any, direction: Any) -> dict[str, Any]:  # noqa: ANN401 -- spectacular protocol
        box = auto_schema.resolve_serializer(EggBoxMarkSerializer(), direction).ref
        point = auto_schema.resolve_serializer(EggPointMarkSerializer(), direction).ref
        return {
            "oneOf": [box, point],
            "discriminator": {
                "propertyName": "kind",
                "mapping": {"box": box["$ref"], "point": point["$ref"]},
            },
        }


class EggAnnotationPayloadSerializer(StrictPayloadSerializer):
    upload_id = serializers.UUIDField()
    marks = serializers.ListField(child=EggMarkSerializer(), max_length=MAX_ANNOTATION_MARKS)
    tool_version = serializers.CharField(max_length=64)
    elapsed_seconds = PixelIntegerField(min_value=0, max_value=2_147_483_647, required=False)


class EggAnnotationSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    public_id = serializers.UUIDField()
    count = serializers.UUIDField()
    bag = serializers.UUIDField()
    bag_code = serializers.CharField()
    upload_id = serializers.UUIDField()
    image_url = serializers.CharField()
    image_width = serializers.IntegerField(min_value=1)
    image_height = serializers.IntegerField(min_value=1)
    marks = serializers.ListField(child=EggMarkSerializer())
    box_count = serializers.IntegerField(min_value=0)
    point_count = serializers.IntegerField(min_value=0)
    tool_version = serializers.CharField()
    elapsed_seconds = serializers.IntegerField(allow_null=True)
    created_by = serializers.UUIDField()
    created_at = serializers.DateTimeField()


class EggAnnotationQuerySerializer(serializers.Serializer[Any]):
    code = serializers.CharField(max_length=50, required=False)
    author = serializers.UUIDField(required=False)
    created_from = serializers.DateTimeField(required=False)
    created_before = serializers.DateTimeField(required=False)
