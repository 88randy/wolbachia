from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext, EventHandler, register
from fleet.codes import FUEL_EFFICIENCY_REVIEW, FUEL_EVENT_NOT_VOIDABLE, FUEL_MOTORCYCLE_MISMATCH
from fleet.fuel_services import apply_fuel_load
from fleet.payloads import FuelLoadPayloadSerializer
from fleet.review import FuelReviewAdapter
from fleet.selectors import highest_fleet_km, motorcycle_metrics
from fleet.services import require_inspection_for_severe
from shifts.codes import MOTORCYCLE_UNKNOWN, ODOMETER_DECREASED, SHIFT_NOT_OPEN
from shifts.extensions import METRIC_READERS, ODOMETER_READERS, UNBLOCK_GUARDS


def refuse_fuel_void(ctx: EventContext, event: FieldEvent) -> None:
    # A correction must preserve interval dependents; acceptance/correction decisions are #22.
    raise EventRejected(FUEL_EVENT_NOT_VOIDABLE)


def register_fleet_handlers() -> None:
    register(
        EventHandler(
            "fuel.load",
            1,
            FuelLoadPayloadSerializer,
            apply_fuel_load,
            on_void=refuse_fuel_void,
            codes=(
                FUEL_EFFICIENCY_REVIEW,
                FUEL_MOTORCYCLE_MISMATCH,
                FUEL_EVENT_NOT_VOIDABLE,
                MOTORCYCLE_UNKNOWN,
                SHIFT_NOT_OPEN,
                ODOMETER_DECREASED,
            ),
            review_adapter=FuelReviewAdapter(),
        )
    )
    ODOMETER_READERS.append(highest_fleet_km)
    METRIC_READERS.append(motorcycle_metrics)
    UNBLOCK_GUARDS.append(require_inspection_for_severe)
