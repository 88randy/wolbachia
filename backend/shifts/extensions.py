"""Optional fleet read/guard hooks; shifts never imports its dependent apps."""

from collections.abc import Callable
from typing import Any

from shifts.models import Motorcycle

ODOMETER_READERS: list[Callable[[Motorcycle], int | None]] = []
METRIC_READERS: list[Callable[[Motorcycle], dict[str, Any]]] = []
UNBLOCK_GUARDS: list[Callable[[Motorcycle], None]] = []
