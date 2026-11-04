"""Builders for the shift tests: `shift.open` / `shift.close` events and the checklist catalog."""

import uuid
from typing import Any

from catalogs.models import CatalogItem
from organizations.models import Organization
from shifts.codes import MOTORCYCLE_CHECK_CATALOG_SLUG
from tests.factories import CatalogFactory, CatalogItemFactory
from tests.sync_support import event

CHECK_ITEM_CODES = ("tires", "brakes", "lights")


def make_check_items(organization: Organization) -> dict[str, CatalogItem]:
    """The closed catalog `motorcycle-check-item` with three active items, by code."""
    catalog = CatalogFactory(
        organization=organization, slug=MOTORCYCLE_CHECK_CATALOG_SLUG, is_open=False
    )
    return {
        code: CatalogItemFactory(catalog=catalog, organization=organization, code=code)
        for code in CHECK_ITEM_CODES
    }


def all_ok_checks() -> list[dict[str, Any]]:
    return [{"item": code, "result": "ok"} for code in CHECK_ITEM_CODES]


def _payload_overrides(overrides: dict[str, Any]) -> dict[str, Any]:
    """Moves the `payload_<name>` keyword arguments out of `overrides` and returns them."""
    names = [key for key in overrides if key.startswith("payload_")]
    return {name.removeprefix("payload_"): overrides.pop(name) for name in names}


def open_event(
    motorcycle_code: str,
    shift_id: uuid.UUID | None = None,
    **overrides: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """A valid `shift.open`; `payload` fields can be overridden with `payload_<name>=...`."""
    payload: dict[str, Any] = {
        "motorcycle_code": motorcycle_code,
        "odometer_km": 12_000,
        "checks": all_ok_checks(),
    }
    payload.update(_payload_overrides(overrides))
    return event(
        type="shift.open",
        payload=payload,
        shift_id=str(shift_id or uuid.uuid4()),
        **overrides,
    )


def close_event(
    shift_id: uuid.UUID,
    odometer_km: int = 12_050,
    **overrides: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """A valid `shift.close`; payload fields can be overridden with `payload_<name>=...`."""
    payload: dict[str, Any] = {"odometer_km": odometer_km}
    payload.update(_payload_overrides(overrides))
    return event(type="shift.close", payload=payload, shift_id=str(shift_id), **overrides)
