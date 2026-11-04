from decimal import Decimal
from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from rules.models import (
    VALUE_DECIMAL_PLACES,
    VALUE_MAX_DIGITS,
    RuleParameter,
    RuleParameterVersion,
    Unit,
    ValueType,
)
from rules.selectors import (
    STATUS_IN_FORCE,
    STATUS_SCHEDULED,
    STATUS_SUPERSEDED,
    STATUS_VOIDED,
    to_number,
)

REASON_MAX_LENGTH = 1000
NULLABLE_NUMBER = serializers.FloatField(allow_null=True)


class RuleParameterSerializer(OrgScopedModelSerializer):
    """A parameter with the value in force now. Values are JSON numbers; null means no version yet.

    `value`, `effective_from`, `version_id` and `next_change_at` come from the annotations of
    `rules.selectors.list_parameters_with_current`.
    """

    min_value = serializers.SerializerMethodField()
    max_value = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField(method_name="current_number")
    effective_from = serializers.DateTimeField(source="current_effective_from", read_only=True)
    version_id = serializers.UUIDField(source="current_version_id", read_only=True)
    next_change_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = RuleParameter
        fields = [
            "key",
            "value_type",
            "unit",
            "min_value",
            "max_value",
            "value",
            "effective_from",
            "version_id",
            "next_change_at",
        ]
        read_only_fields = fields

    @extend_schema_field(NULLABLE_NUMBER)
    def get_min_value(self, parameter: RuleParameter) -> int | float | None:
        return _number_or_none(parameter.value_type, parameter.min_value)

    @extend_schema_field(NULLABLE_NUMBER)
    def get_max_value(self, parameter: RuleParameter) -> int | float | None:
        return _number_or_none(parameter.value_type, parameter.max_value)

    @extend_schema_field(NULLABLE_NUMBER)
    def current_number(self, parameter: RuleParameter) -> int | float | None:
        return _number_or_none(parameter.value_type, parameter.current_value)  # type: ignore[attr-defined]


class RuleParameterVersionSerializer(OrgScopedModelSerializer):
    """Read shape of a version, with its `status` at the time of the request."""

    value = serializers.SerializerMethodField(method_name="number")
    status = serializers.ChoiceField(
        choices=[STATUS_SCHEDULED, STATUS_IN_FORCE, STATUS_SUPERSEDED, STATUS_VOIDED],
        read_only=True,
    )

    class Meta:
        model = RuleParameterVersion
        fields = [
            "id",
            "value",
            "effective_from",
            "effective_date",
            "reason",
            "status",
            "created_by",
            "created_at",
            "voided_at",
            "voided_by",
            "void_reason",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.FloatField())
    def number(self, version: RuleParameterVersion) -> int | float:
        return to_number(version.parameter.value_type, version.value)


class RuleParameterVersionCreateSerializer(OrgScopedModelSerializer):
    """`effective_from` is a local calendar date (`YYYY-MM-DD`): the server resolves the instant."""

    value = serializers.DecimalField(
        max_digits=VALUE_MAX_DIGITS, decimal_places=VALUE_DECIMAL_PLACES
    )
    effective_from = serializers.DateField()
    reason = serializers.CharField(
        allow_blank=False, trim_whitespace=True, max_length=REASON_MAX_LENGTH
    )

    class Meta:
        model = RuleParameterVersion
        fields = ["value", "effective_from", "reason"]


class SnapshotParameterSerializer(serializers.Serializer[Any]):
    """Documents the field rules snapshot (the payload is built by `build_rules_snapshot`)."""

    key = serializers.CharField()
    value_type = serializers.ChoiceField(choices=ValueType.choices)
    unit = serializers.ChoiceField(choices=Unit.choices)
    value = serializers.FloatField(allow_null=True, help_text="Null: not configured yet.")
    effective_from = serializers.DateTimeField(allow_null=True)
    version_id = serializers.UUIDField(allow_null=True)


class RulesSnapshotSerializer(serializers.Serializer[Any]):
    """The values in force now. `version` is also the `ETag`."""

    version = serializers.CharField()
    next_change_at = serializers.DateTimeField(
        allow_null=True, help_text="When the next scheduled version takes effect, if any."
    )
    parameters = SnapshotParameterSerializer(many=True)


def _number_or_none(value_type: str, value: Decimal | None) -> int | float | None:
    return None if value is None else to_number(value_type, value)
