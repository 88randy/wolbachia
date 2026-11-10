"""Response schema of every dashboard: indicators, charts (series + table) and notes."""

from typing import Any

from rest_framework import serializers


class LabelSerializer(serializers.Serializer[Any]):
    code = serializers.CharField()
    params = serializers.DictField()


class IndicatorSerializer(serializers.Serializer[Any]):
    key = serializers.CharField()
    label = LabelSerializer()  # type: ignore[assignment]
    value = serializers.FloatField(allow_null=True)
    unit = serializers.CharField()


class SeriesSerializer(serializers.Serializer[Any]):
    key = serializers.CharField()
    label = LabelSerializer()  # type: ignore[assignment]
    points = serializers.ListField(child=serializers.DictField())


class ColumnSerializer(serializers.Serializer[Any]):
    key = serializers.CharField()
    label = LabelSerializer()  # type: ignore[assignment]


class TableSerializer(serializers.Serializer[Any]):
    columns = ColumnSerializer(many=True)
    rows = serializers.ListField(child=serializers.DictField())


class ChartSerializer(serializers.Serializer[Any]):
    key = serializers.CharField()
    kind = serializers.ChoiceField(choices=("bar", "line"))
    label = LabelSerializer()  # type: ignore[assignment]
    unit = serializers.CharField()
    series = SeriesSerializer(many=True)
    table = TableSerializer()


class DashboardFiltersSerializer(serializers.Serializer[Any]):
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    granularity = serializers.ChoiceField(choices=("day", "week"))
    center = serializers.UUIDField(allow_null=True)
    quadrant = serializers.UUIDField(allow_null=True)


class DashboardSerializer(serializers.Serializer[Any]):
    cutoff = serializers.DateTimeField()
    filters = DashboardFiltersSerializer()
    indicators = IndicatorSerializer(many=True)
    charts = ChartSerializer(many=True)
    notes = LabelSerializer(many=True)
