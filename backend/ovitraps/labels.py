"""Pre-registered ovitrap labels: mint a batch, list the unplaced pool, pick the code at placement."""

from uuid import UUID, uuid4

from django.db import transaction
from django.db.models import Exists, OuterRef, QuerySet

from accounts.models import User
from organizations.codes import OVITRAP_CODE, allocate_code, allocate_codes
from organizations.models import Organization
from ovitraps.models import Ovitrap, OvitrapLabel

MAX_MINT = 200
# Upper bound of the pool a phone downloads; the oldest unplaced labels come first.
MAX_POOL = 5000


def mint_labels(organization: Organization, user: User, count: int) -> list[OvitrapLabel]:
    """Register `count` new labels with consecutive codes in one transaction."""
    if not 1 <= count <= MAX_MINT:
        raise ValueError("count out of range")
    with transaction.atomic():
        codes = allocate_codes(organization, OVITRAP_CODE, count)
        return OvitrapLabel.objects.bulk_create(
            [
                OvitrapLabel(
                    organization=organization, created_by=user, client_uuid=uuid4(), code=code
                )
                for code in codes
            ]
        )


def unplaced_labels(organization: Organization) -> QuerySet[OvitrapLabel]:
    placed = Ovitrap.objects.filter(organization=organization, client_uuid=OuterRef("client_uuid"))
    return (
        OvitrapLabel.objects.filter(organization=organization)
        .filter(~Exists(placed))
        .order_by("created_at", "code")
    )


def code_for_new_ovitrap(organization: Organization, client_uuid: UUID) -> str:
    """The code of a trap being created: its label's, or a fresh one for an unregistered QR.

    Call inside the writer's transaction (the counter lock is held until it ends).
    """
    code = (
        OvitrapLabel.objects.filter(organization=organization, client_uuid=client_uuid)
        .values_list("code", flat=True)
        .first()
    )
    return code if code is not None else allocate_code(organization, OVITRAP_CODE)
