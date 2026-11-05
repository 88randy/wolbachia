"""Device and DeviceSession: org-scoped, never deleted, tokens only as unique digests."""

import uuid

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.models import Device, DeviceSession, RevokeReason
from accounts.tokens import generate_token, hash_token
from core.exceptions import PhysicalDeleteForbiddenError
from core.models import OrgScopedModel
from organizations.models import Organization
from tests.factories import DeviceFactory, DeviceSessionFactory, TokenPairFactory

pytestmark = pytest.mark.django_db


def test_device_and_session_are_org_scoped_models() -> None:
    assert issubclass(Device, OrgScopedModel)
    assert issubclass(DeviceSession, OrgScopedModel)


def test_device_uses_the_client_generated_uuid_as_primary_key(org_a: Organization) -> None:
    device_id = uuid.uuid4()

    device = DeviceFactory(id=device_id, organization=org_a)

    assert Device.objects.get(pk=device_id) == device


def test_devices_are_scoped_to_their_organization(org_a: Organization, org_b: Organization) -> None:
    device = DeviceFactory(organization=org_a)
    DeviceFactory(organization=org_b)

    assert list(Device.objects.for_org(org_a)) == [device]


def test_device_and_session_cannot_be_deleted(org_a: Organization) -> None:
    session = DeviceSessionFactory(organization=org_a)

    with pytest.raises(PhysicalDeleteForbiddenError):
        session.device.delete()
    with pytest.raises(PhysicalDeleteForbiddenError):
        DeviceSession.objects.all().delete()


@pytest.mark.parametrize("field", ["access_hash", "refresh_hash"])
def test_token_digests_are_unique(org_a: Organization, field: str) -> None:
    first = TokenPairFactory(session__organization=org_a)

    with pytest.raises(IntegrityError), transaction.atomic():
        TokenPairFactory(session=first.session, **{field: getattr(first, field)})


def test_token_pairs_are_org_scoped_and_refuse_general_delete(org_a: Organization) -> None:
    pair = TokenPairFactory(session__organization=org_a)

    assert isinstance(pair, OrgScopedModel)
    assert pair.organization == org_a
    with pytest.raises(PhysicalDeleteForbiddenError):
        pair.delete()


def test_a_pair_is_consumed_and_superseded_together(org_a: Organization) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        TokenPairFactory(session__organization=org_a, consumed_at=timezone.now())
    with pytest.raises(IntegrityError), transaction.atomic():
        TokenPairFactory(session__organization=org_a, superseded_at=timezone.now())


def test_a_digest_is_a_64_character_hex_sha256_and_differs_from_the_token() -> None:
    token = generate_token()

    digest = hash_token(token)

    assert len(digest) == 64
    assert digest != token
    assert int(digest, 16) >= 0


def test_generated_tokens_are_unique_and_long() -> None:
    tokens = {generate_token() for _ in range(50)}

    assert len(tokens) == 50
    assert all(len(token) >= 43 for token in tokens)  # 32 random bytes in URL-safe base64


def test_session_revocation_fields_are_all_or_nothing(org_a: Organization) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        DeviceSessionFactory(organization=org_a, revoked_at=timezone.now(), revoke_reason="")
    with pytest.raises(IntegrityError), transaction.atomic():
        DeviceSessionFactory(organization=org_a, revoke_reason=RevokeReason.LOGOUT)


def test_device_revocation_fields_are_consistent(org_a: Organization) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        DeviceFactory(organization=org_a, is_revoked=True)
    with pytest.raises(IntegrityError), transaction.atomic():
        DeviceFactory(organization=org_a, is_revoked=False, revoked_at=timezone.now())
