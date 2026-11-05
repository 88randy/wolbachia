"""Register schema-1 placement/check handlers, following shifts/handlers.py."""

from field_sync.registry import EventHandler, register
from ovitraps.codes import CODES
from ovitraps.payloads import CheckPayloadSerializer, PlacePayloadSerializer
from ovitraps.services import check_ovitrap, place_ovitrap, void_ovitrap_event


def register_ovitrap_handlers() -> None:
    register(
        EventHandler(
            "ovitrap.place",
            1,
            PlacePayloadSerializer,
            place_ovitrap,
            on_void=void_ovitrap_event,
            codes=CODES,
        )
    )
    register(
        EventHandler(
            "ovitrap.check",
            1,
            CheckPayloadSerializer,
            check_ovitrap,
            on_void=void_ovitrap_event,
            codes=CODES,
        )
    )
