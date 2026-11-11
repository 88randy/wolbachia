"""Abstract base for versions that store their geodesic measurements."""

from typing import Any

from django.db import models

from geography.geometry import polygon_measurements


class MeasuredGeometryMixin(models.Model):
    """Geodesic area/perimeter computed once from the polygon when the version is inserted."""

    geometry = models.JSONField()
    area_m2 = models.FloatField(null=True, editable=False)
    perimeter_m = models.FloatField(null=True, editable=False)

    class Meta:
        abstract = True

    def save(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        if self._state.adding and self.area_m2 is None:
            self.area_m2, self.perimeter_m = polygon_measurements(self.geometry)
        super().save(*args, **kwargs)
