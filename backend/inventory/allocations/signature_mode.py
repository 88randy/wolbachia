"""Where the courier signs a delivery: the warehouse screen, the courier's phone, or either.

Organization rule `delivery_signature_mode` (integer: 0 = either, 1 = warehouse, 2 = phone). The
default is "either": whichever signature happens first completes it. Pure rules live here so
every mode can be checked without a database.
"""

from typing import Any

from django.utils import timezone

from inventory.exceptions import InventoryConflictError
from organizations.models import Organization

RULE_KEY = "delivery_signature_mode"
MODES = {0: "either", 1: "warehouse", 2: "phone"}
CHANNEL_WAREHOUSE = "warehouse_screen"
CHANNEL_PHONE = "courier_device"


def delivery_signature_mode(organization: Organization) -> str:
    """The rule in force now; a missing rule or version means "either"."""
    from rules.models import RuleParameter
    from rules.selectors import get_version_in_force

    parameter = RuleParameter.objects.filter(organization=organization, key=RULE_KEY).first()
    version = None if parameter is None else get_version_in_force(parameter, timezone.now())
    return MODES.get(0 if version is None else int(version.value), "either")


def check_signature_channel(mode: str, has_signature: bool) -> None:
    """A release that carries a courier signature is a warehouse-screen signature.

    `warehouse` requires it; `phone` refuses it (the courier signs on the phone); `either` takes
    both: without it the delivery waits for the phone.
    """
    if mode == "warehouse" and not has_signature:
        raise InventoryConflictError("supply_signature_required")
    if mode == "phone" and has_signature:
        raise InventoryConflictError("supply_signature_channel_not_allowed")


def signature_proof(
    declared_evidence: list[dict[str, Any]], captured_by: str
) -> dict[str, Any] | None:
    """What the release records when the courier signed on the warehouse screen."""
    if not any(row.get("role") == "signature" for row in declared_evidence):
        return None
    return {"channel": CHANNEL_WAREHOUSE, "captured_by": captured_by}


def signature_facts(
    release_proof: dict[str, Any] | None, received_by: str | None
) -> dict[str, Any]:
    """`signed` (with channel and who captured it) or `pending_phone`, from the stored facts.

    `release_proof` is the release's recorded proof; `received_by` is the name of whoever sent the
    courier's signed receipt from the phone, or None.
    """
    recorded = (release_proof or {}).get("signature")
    if recorded:
        return {
            "state": "signed",
            "channel": recorded["channel"],
            "captured_by": recorded.get("captured_by_name"),
        }
    if received_by is not None:
        return {"state": "signed", "channel": CHANNEL_PHONE, "captured_by": received_by}
    return {"state": "pending_phone", "channel": None, "captured_by": None}
