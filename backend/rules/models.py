"""Rule parameters: thresholds the app shows but never decides (decision 5), kept per organization.

Editing a parameter never overwrites a value: it adds a `RuleParameterVersion` with an effective
date. Versions are insert-only; a wrong version that has not taken effect yet is voided (never
deleted) and a corrected one is added.
"""

from django.core.validators import RegexValidator
from django.db import models

from core.models import (
    ImmutableMixin,
    ImmutableQuerySet,
    OrgScopedModel,
    VoidableMixin,
    VoidableQuerySet,
)

KEY_MAX_LENGTH = 64
CHOICE_MAX_LENGTH = 10
VALUE_MAX_DIGITS = 12
VALUE_DECIMAL_PLACES = 3

validate_parameter_key = RegexValidator(
    r"^[a-z][a-z0-9_]*$", "Use lowercase snake_case, e.g. max_distance_to_point_m."
)


class ValueType(models.TextChoices):
    INTEGER = "integer"
    DECIMAL = "decimal"


class Unit(models.TextChoices):
    METERS = "m"
    KILOMETERS_PER_HOUR = "km_h"
    SECONDS = "s"
    MINUTES = "min"
    DAYS = "day"
    WEEKS = "week"
    COUNT = "count"
    KILOMETERS_PER_LITER = "km_l"


class RuleParameter(OrgScopedModel):
    """The definition of a threshold. Created by the seed only: there is no POST.

    `min_value` and `max_value` bound every version (inclusive); null means unbounded.
    """

    key = models.CharField(max_length=KEY_MAX_LENGTH, validators=[validate_parameter_key])
    value_type = models.CharField(max_length=CHOICE_MAX_LENGTH, choices=ValueType.choices)
    unit = models.CharField(max_length=CHOICE_MAX_LENGTH, choices=Unit.choices)
    min_value = models.DecimalField(
        max_digits=VALUE_MAX_DIGITS, decimal_places=VALUE_DECIMAL_PLACES, null=True, blank=True
    )
    max_value = models.DecimalField(
        max_digits=VALUE_MAX_DIGITS, decimal_places=VALUE_DECIMAL_PLACES, null=True, blank=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "key"], name="rule_parameter_unique_key_per_organization"
            )
        ]

    def __str__(self) -> str:
        return self.key


class VersionQuerySet(ImmutableQuerySet, VoidableQuerySet):  # type: ignore[override]
    """Insert-only rows that can still be voided."""


class RuleParameterVersion(ImmutableMixin, VoidableMixin, OrgScopedModel):
    """One value of a parameter from `effective_from` on. Insert-only, never deleted.

    `effective_from` is the instant it starts to apply (UTC). `effective_date` is the same
    moment as a calendar date in the organization's timezone: the service allows one non-voided
    version per future date (the parameter row is locked while checking). Only the void fields
    can change, and only from null: the migration adds a PostgreSQL trigger that enforces it,
    and forbids deleting. `created_by` is null only for seed data.
    """

    mutable_fields = frozenset({"voided_at", "voided_by", "void_reason"})

    parameter = models.ForeignKey(RuleParameter, on_delete=models.PROTECT, related_name="versions")
    value = models.DecimalField(max_digits=VALUE_MAX_DIGITS, decimal_places=VALUE_DECIMAL_PLACES)
    effective_from = models.DateTimeField()
    effective_date = models.DateField()
    reason = models.TextField()

    objects = VersionQuerySet.as_manager()  # type: ignore[misc,assignment]

    class Meta(ImmutableMixin.Meta, VoidableMixin.Meta):
        indexes = [models.Index(fields=["parameter", "-effective_from"])]

    def __str__(self) -> str:
        return f"{self.parameter_id}@{self.effective_date}"
