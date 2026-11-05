"""Schema 1 keeps the immutable human motorcycle code, like shift.open."""

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from shifts.models import CODE_MAX_LENGTH


class FuelLoadPayloadSerializer(serializers.Serializer[Any]):
    motorcycle_id = serializers.CharField(max_length=CODE_MAX_LENGTH)
    litres = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.RegexField(r"^[A-Z]{3}$")
    odometer_km = serializers.IntegerField(min_value=0, max_value=999999)
    receipt_upload_id = serializers.UUIDField(allow_null=True)
    is_full_refill = serializers.BooleanField()
