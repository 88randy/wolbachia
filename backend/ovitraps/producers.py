"""App-owned projection registration; field_sync never imports domain apps."""

from field_sync.projection_serializers import OvitrapBundleSerializer
from ovitraps.selectors import build_ovitrap_bundle


def register_ovitrap_producers() -> None:
    from field_sync.producers import BundleProducer, register

    register(BundleProducer("ovitraps", 1, build_ovitrap_bundle, OvitrapBundleSerializer))
