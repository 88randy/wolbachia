"""Register B-15 schema-1 effects through the existing sync savepoint pipeline."""

from field_sync.registry import EventHandler, register
from ovitraps.codes import CODES
from ovitraps.lifecycle.serializers import PAYLOAD_SERIALIZERS
from ovitraps.lifecycle.services import apply_lifecycle, void_lifecycle_event


def register_lifecycle_handlers() -> None:
    for kind, serializer in PAYLOAD_SERIALIZERS.items():
        register(
            EventHandler(
                f"ovitrap.{kind}",
                1,
                serializer,
                apply_lifecycle,
                on_void=void_lifecycle_event,
                codes=CODES,
            )
        )
