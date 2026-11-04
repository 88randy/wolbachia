"""Payload serializers of `shift.open` and `shift.close` (validated by the sync pipeline)."""

from typing import Any

from rest_framework import serializers

from catalogs.models import CODE_MAX_LENGTH as ITEM_CODE_MAX_LENGTH
from shifts.models import CODE_MAX_LENGTH, NOTE_MAX_LENGTH, CheckResult

# A motorcycle checklist has a handful of lines; the cap only stops abuse.
MAX_CHECKS = 50


class CheckPayloadSerializer(serializers.Serializer[Any]):
    """One checklist line: the catalog item (by its `code`), the result and an optional note."""

    item = serializers.CharField(max_length=ITEM_CODE_MAX_LENGTH)
    result = serializers.ChoiceField(choices=CheckResult.choices)
    note = serializers.CharField(
        max_length=NOTE_MAX_LENGTH, required=False, allow_blank=True, default=""
    )


class ShiftOpenPayloadSerializer(serializers.Serializer[Any]):
    """`{motorcycle_code, odometer_km, checks[], note?}`. The shift id is the envelope's
    `shift_id`. The upper bound of `odometer_km` is checked by the handler (`odometer_out_of_range`)."""

    motorcycle_code = serializers.CharField(max_length=CODE_MAX_LENGTH, trim_whitespace=True)
    odometer_km = serializers.IntegerField(min_value=0)
    checks = serializers.ListField(
        child=CheckPayloadSerializer(), allow_empty=True, max_length=MAX_CHECKS
    )
    note = serializers.CharField(
        max_length=NOTE_MAX_LENGTH, required=False, allow_blank=True, default=""
    )


class ShiftClosePayloadSerializer(serializers.Serializer[Any]):
    """`{odometer_km, note?}`. The shift is the envelope's `shift_id`."""

    odometer_km = serializers.IntegerField(min_value=0)
    note = serializers.CharField(
        max_length=NOTE_MAX_LENGTH, required=False, allow_blank=True, default=""
    )
