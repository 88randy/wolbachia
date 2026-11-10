"""Authored bounded transfer grants and append-only withdrawals; no legal defaults."""

from dataclasses import dataclass
from datetime import datetime
from typing import cast
from uuid import UUID

from django.http import Http404
from django.utils.timezone import is_aware

from core.exceptions import FieldValidationError
from core.void_reason import validate_void_reason, visible_length
from geography.models import Quadrant
from inventory.allocations.scope import require_contexts
from inventory.transactions import inventory_transaction
from organizations.models import Center
from privacy.models import DataTransferAuthorization, DataTransferRevocation
from privacy.selectors import SHIPMENT_TRANSFER_PURPOSE
from uploads.access import UploadActor

TRANSFER_AUTHORIZATION_MANAGE = "transfer_authorization.manage"
TRANSFER_REVOCATION_MIN_LENGTH = 10


@dataclass(frozen=True)
class TransferAuthorizationInput:
    recipient_institution: str
    center_id: UUID
    quadrant_id: UUID | None
    valid_from: datetime
    valid_until: datetime
    reference: str
    fields: tuple[str, ...]


def create_transfer_authorization(
    actor: UploadActor, request: TransferAuthorizationInput
) -> DataTransferAuthorization:
    """Create only an explicit human authorization for a real same-tenant context."""
    with inventory_transaction(actor):
        center = Center.objects.filter(
            organization=actor.organization, pk=request.center_id
        ).first()
        if center is None:
            raise Http404
        if (
            request.quadrant_id is not None
            and not Quadrant.objects.filter(
                organization=actor.organization, center=center, pk=request.quadrant_id
            ).exists()
        ):
            raise Http404
        require_contexts(actor, TRANSFER_AUTHORIZATION_MANAGE, [_request_context(request)])
        _validate_authorization(request)
        return cast(
            DataTransferAuthorization,
            DataTransferAuthorization.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                recipient_institution=request.recipient_institution.strip(),
                purpose=SHIPMENT_TRANSFER_PURPOSE,
                fields=list(request.fields),
                center=center,
                quadrant_id=request.quadrant_id,
                valid_from=request.valid_from,
                valid_until=request.valid_until,
                reference=request.reference.strip(),
            ),
        )


def _request_context(request: TransferAuthorizationInput) -> dict[str, str | None]:
    return {
        "center_id": str(request.center_id),
        "quadrant_id": str(request.quadrant_id) if request.quadrant_id is not None else None,
    }


def _validate_authorization(request: TransferAuthorizationInput) -> None:
    if request.fields != ("rfc",):
        raise FieldValidationError("fields", "unsupported_transfer_fields")
    if (
        not request.recipient_institution.strip()
        or len(request.recipient_institution.strip()) > 200
    ):
        raise FieldValidationError("recipient_institution", "invalid")
    if not request.reference.strip() or len(request.reference.strip()) > 1000:
        raise FieldValidationError("reference", "invalid")
    if not is_aware(request.valid_from) or not is_aware(request.valid_until):
        raise FieldValidationError("valid_until", "invalid")
    if request.valid_until <= request.valid_from:
        raise FieldValidationError("valid_until", "invalid_interval")


def revoke_transfer_authorization(
    actor: UploadActor, identifier: UUID, reason: str
) -> DataTransferRevocation:
    """Withdraw permanently without altering the authorization or any issued snapshot."""
    with inventory_transaction(actor):
        authorization = DataTransferAuthorization.objects.filter(
            organization=actor.organization, pk=identifier
        ).first()
        if authorization is None:
            raise Http404
        require_contexts(
            actor,
            TRANSFER_AUTHORIZATION_MANAGE,
            [
                {
                    "center_id": str(authorization.center_id),
                    "quadrant_id": str(authorization.quadrant_id)
                    if authorization.quadrant_id
                    else None,
                }
            ],
        )
        normalized = validate_void_reason(reason, "reason", enforce_minimum=True)
        if visible_length(normalized) < TRANSFER_REVOCATION_MIN_LENGTH:
            raise FieldValidationError(
                "reason", "void_reason_too_short", {"min_length": TRANSFER_REVOCATION_MIN_LENGTH}
            )
        revocation, _created = DataTransferRevocation.objects.get_or_create(
            organization=actor.organization,
            authorization=authorization,
            defaults={"created_by": actor.user, "reason": normalized},
        )
        return cast(DataTransferRevocation, revocation)
