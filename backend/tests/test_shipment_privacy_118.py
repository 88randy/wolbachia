"""Shipment RFC eligibility requires current purpose, recipient and paired authority."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from django.http import Http404
from rest_framework.exceptions import ValidationError

from core.exceptions import FieldValidationError
from geography.models import Quadrant
from organizations.models import Center, all_scope
from privacy.selectors import can_transfer_rfc
from privacy.services import (
    TransferAuthorizationInput,
    create_transfer_authorization,
    revoke_transfer_authorization,
)
from uploads.access import UploadActor

AT = datetime(2026, 11, 7, 18, tzinfo=UTC)


@pytest.fixture
def transfer_context(org_a, make_member, monkeypatch):
    monkeypatch.setattr("privacy.selectors.server_now", lambda: AT)
    user, member = make_member(org_a, ["transfer_authorization.manage", "shipment.rfc_transfer"])
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    center = Center.objects.create(
        organization=org_a, created_by=user, code="PRIV-118", name="Synthetic privacy center"
    )
    quadrant = Quadrant.objects.create(
        organization=org_a, created_by=user, center=center, code="PRIV-Q-118"
    )
    return UploadActor(user, org_a), center, quadrant, profile


def authorization_input(center, quadrant, **changes):
    values = {
        "recipient_institution": "Synthetic recipient institution",
        "center_id": center.pk,
        "quadrant_id": quadrant.pk,
        "valid_from": AT - timedelta(days=1),
        "valid_until": AT + timedelta(days=1),
        "reference": "Synthetic authorization reference, no operational approval",
        "fields": ("rfc",),
    }
    return TransferAuthorizationInput(**{**values, **changes})


def context_vector(center, quadrant):
    return [{"center_id": str(center.pk), "quadrant_id": str(quadrant.pk)}]


@pytest.mark.django_db
def test_transfer_absence_revocation_and_action_loss_fail_closed(transfer_context):
    actor, center, quadrant, profile = transfer_context
    vector = context_vector(center, quadrant)
    recipient = "Synthetic recipient institution"
    assert not can_transfer_rfc(actor, recipient, vector)
    authorization = create_transfer_authorization(actor, authorization_input(center, quadrant))
    assert can_transfer_rfc(actor, recipient, vector)
    assert not can_transfer_rfc(actor, "Different recipient", vector)
    profile.permission_codes = ["transfer_authorization.manage"]
    profile.save(update_fields=["permission_codes"])
    assert not can_transfer_rfc(actor, recipient, vector)
    profile.permission_codes = ["transfer_authorization.manage", "shipment.rfc_transfer"]
    profile.save(update_fields=["permission_codes"])
    revoke_transfer_authorization(actor, authorization.pk, "Synthetic withdrawal reason")
    assert not can_transfer_rfc(actor, recipient, vector)


@pytest.mark.django_db
def test_transfer_requires_every_real_context_and_current_time(transfer_context):
    actor, center, quadrant, _profile = transfer_context
    recipient = "Synthetic recipient institution"
    create_transfer_authorization(actor, authorization_input(center, quadrant, valid_until=AT))
    vector = context_vector(center, quadrant)
    assert not can_transfer_rfc(actor, recipient, vector)
    create_transfer_authorization(actor, authorization_input(center, quadrant))
    assert can_transfer_rfc(actor, recipient, vector)
    assert not can_transfer_rfc(actor, recipient, [])
    assert not can_transfer_rfc(
        actor, recipient, [*vector, {"center_id": str(center.pk), "quadrant_id": str(uuid4())}]
    )


@pytest.mark.django_db
def test_transfer_management_preserves_scope_and_reason_validation(transfer_context, org_b):
    actor, center, quadrant, _profile = transfer_context
    foreign = Center.objects.create(
        organization=org_b, created_by=actor.user, code="FOREIGN", name="Synthetic foreign"
    )
    with pytest.raises(Http404):
        create_transfer_authorization(actor, authorization_input(foreign, quadrant))
    with pytest.raises(FieldValidationError):
        create_transfer_authorization(
            actor, authorization_input(center, quadrant, valid_until=AT - timedelta(days=2))
        )
    authorization = create_transfer_authorization(actor, authorization_input(center, quadrant))
    with pytest.raises(ValidationError):
        revoke_transfer_authorization(actor, authorization.pk, "short")
    revocation = revoke_transfer_authorization(
        actor, authorization.pk, "  Synthetic withdrawal\r\nreason  "
    )
    assert revocation.reason == "Synthetic withdrawal\nreason"
    assert (
        revoke_transfer_authorization(actor, authorization.pk, revocation.reason).pk
        == revocation.pk
    )
