"""Current recipient/purpose/field eligibility is never frozen into issued evidence."""

from collections.abc import Sequence

from rest_framework.exceptions import PermissionDenied

from core.time import server_now
from inventory.transfers.scope import StorageContext, allows_transfer_vector
from privacy.models import DataTransferAuthorization
from uploads.access import UploadActor, current_scope

SHIPMENT_RFC_TRANSFER = "shipment.rfc_transfer"
SHIPMENT_TRANSFER_PURPOSE = "uieb_shipment"


def can_transfer_rfc(
    actor: UploadActor, recipient_institution: str, contexts: Sequence[StorageContext]
) -> bool:
    """Require one current actor grant over the full vector and live exact transfer facts."""
    try:
        scope = current_scope(actor)
    except PermissionDenied:
        return False
    if not actor.user.is_active or not allows_transfer_vector(
        scope, SHIPMENT_RFC_TRANSFER, contexts
    ):
        return False
    now = server_now()
    grants = DataTransferAuthorization.objects.filter(
        organization=actor.organization,
        organization__is_active=True,
        recipient_institution=recipient_institution,
        purpose=SHIPMENT_TRANSFER_PURPOSE,
        fields=["rfc"],
        valid_from__lte=now,
        valid_until__gt=now,
        revocation__isnull=True,
        center__organization=actor.organization,
    )
    return all(
        grants.filter(center_id=pair["center_id"], quadrant_id=pair["quadrant_id"]).exists()
        for pair in contexts
    )
