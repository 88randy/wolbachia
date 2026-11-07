"""Single history owner: #126 extends this typed producer instead of registering another."""

from field_sync.producers import BundleProducer, register
from reviews.history import build_history
from reviews.history_serializers import CourierHistoryEntrySerializer


def register_history_producer() -> None:
    register(BundleProducer("history", 3, build_history, CourierHistoryEntrySerializer))
