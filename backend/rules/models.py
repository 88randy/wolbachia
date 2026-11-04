"""Rule parameters: thresholds the app shows but never decides (decision 5), kept per organization.

Editing a parameter never overwrites a value: it adds a `RuleParameterVersion` with an effective
date. Versions are immutable, and nothing here is deleted.
"""

from typing import Any

from django.core.validators import RegexValidator
from django.db import models

from core.models import OrgScopedModel, OrgScopedQuerySet
from rules.exceptions import ImmutableRecordError

KEY_MAX_LENGTH = 64
VALUE_MAX_DIGITS = 12
VALUE_DECIMAL_PLACES = 3
IMMUTABLE_MESSAGE = "Rule parameter versions are never modified; add a new version instead."

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
    WEEKS = "week"
    COUNT = "count"
    KILOMETERS_PER_LITER = "km_l"


class RuleParameter(OrgScopedModel):
    """The definition of a threshold. Created by the seed only: there is no POST.

    `min_value` and `max_value` bound every version (inclusive); null means unbounded.
    """

    key = models.CharField(max_length=KEY_MAX_LENGTH, validators=[validate_parameter_key])
    value_type = models.CharField(max_length=10, choices=ValueType.choices)
    unit = models.CharField(max_length=10, choices=Unit.choices)
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


class ImmutableQuerySet(OrgScopedQuerySet):
    def update(self, **kwargs: Any) -> int:  # noqa: ANN401
        raise ImmutableRecordError(IMMUTABLE_MESSAGE)


class RuleParameterVersion(OrgScopedModel):
    """One value of a parameter from `effective_from` on. Never updated, never deleted.

    `effective_from` is the instant it starts to apply (UTC). `effective_date` is the same
    moment as a calendar date in the organization's timezone, so two versions cannot be
    scheduled for the same local day. `created_by` is null only for seed data.
    """

    parameter = models.ForeignKey(RuleParameter, on_delete=models.PROTECT, related_name="versions")
    value = models.DecimalField(max_digits=VALUE_MAX_DIGITS, decimal_places=VALUE_DECIMAL_PLACES)
    effective_from = models.DateTimeField()
    effective_date = models.DateField()
    reason = models.TextField()

    objects = ImmutableQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["parameter", "effective_date"],
                name="rule_version_unique_date_per_parameter",
            )
        ]
        indexes = [models.Index(fields=["parameter", "-effective_from"])]

    def save(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        if not self._state.adding:
            raise ImmutableRecordError(IMMUTABLE_MESSAGE)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.parameter_id}@{self.effective_date}"
