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


def test_dissociated_session_cannot_regain_people_credentials_or_final_upload(monkeypatch):
    from datetime import UTC, datetime, timedelta
    from types import SimpleNamespace

    from django.db import DatabaseError, connection

    from accounts import session_audit_retention as audit
    from accounts.exceptions import InvalidTokenError, SessionRevokedError
    from accounts.final_upload import FinalUploadMixin
    from accounts.revocation import consume_final_upload, is_final_upload_available
    from accounts.token_pairs import issue_pair

    now = datetime(2026, 11, 4, 12, tzinfo=UTC)
    monkeypatch.setattr(audit, "server_now", lambda: now)
    session = DeviceSessionFactory()
    stale = DeviceSession.objects.get(pk=session.pk)
    audit.remember_end(session, None, now - timedelta(days=400))
    assert audit.dissociate_ended_sessions().sessions_dissociated == 1
    session.refresh_from_db()
    with pytest.raises(InvalidTokenError):
        issue_pair(stale)
    assert not is_final_upload_available(session, now)
    with pytest.raises(SessionRevokedError):
        consume_final_upload(session)

    class InitialBoundary:
        def initial(self, _request):
            pass

    class GuardedFinalUpload(FinalUploadMixin, InitialBoundary):
        pass

    view = GuardedFinalUpload()
    with pytest.raises(SessionRevokedError):
        view.initial(SimpleNamespace(auth=session, method="POST"))
    with pytest.raises(SessionRevokedError):
        view._acquire_final_upload_participants(session, ())
    assert view._final_upload_transaction is None
    for changes in (
        {"user_id": stale.user_id},
        {"created_by_id": stale.user_id},
        {"revoked_by_id": stale.user_id},
        {"last_used_at": now},
        {"final_upload_deadline": now + timedelta(days=1)},
    ):
        with pytest.raises(DatabaseError), transaction.atomic():
            DeviceSession.objects.filter(pk=session.pk).update(**changes)
    with pytest.raises(DatabaseError), transaction.atomic():
        TokenPairFactory(session=session)
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("DELETE FROM accounts_devicesession WHERE id=%s", [session.pk])
    assert DeviceSession.objects.filter(pk=session.pk, user__isnull=True).exists()
