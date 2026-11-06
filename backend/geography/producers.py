"""Register geography projections from AppConfig.ready; no import-time registration."""

from field_sync.projection_serializers import (
    QuadrantReferenceSerializer,
    SamplingPointBundleSerializer,
)
from geography.selectors import build_quadrant_references, build_sampling_points


def register_geography_producers() -> None:
    from field_sync.producers import BundleProducer, register

    register(BundleProducer("quadrants", 1, build_quadrant_references, QuadrantReferenceSerializer))
    register(
        BundleProducer("sampling_points", 1, build_sampling_points, SamplingPointBundleSerializer)
    )
