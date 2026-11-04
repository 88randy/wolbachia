"""Token issuing, refresh families with reuse detection, revocation and the final upload."""

import threading
import uuid
from datetime import timedelta

import pytest
from django.db import connection, transaction
from django.test import override_settings
from django.utils import timezone
from rest_framework.exceptions import Throttled

from accounts.exceptions import (
    DeviceOrganizationMismatchError,
    DeviceRevokedError,
    InvalidCredentialsError,
    InvalidTokenError,
    SessionRevokedError,
    TokenExpiredError,
)
from accounts.models import Device, DeviceSession, RevokeReason, TokenPair, User
from accounts.revocation import (
    Revocation,
    consume_final_upload,
    revoke_device,
    revoke_session,
    revoke_user_sessions,
)
from accounts.services import DeviceInfo, start_device_session
from accounts.token_pairs import (
    MAX_SIBLING_PAIRS,
    IssuedTokens,
    claim_access_use,
    is_access_superseded,
    is_retired_sibling,
    issue_pair,
    rotate_refresh_token,
)
from accounts.tokens import hash_token
from organizations.models import Membership, Organization
from tests.factories import DeviceFactory, MembershipFactory, UserFactory

pytestmark = pytest.mark.django_db


def login(
    user: User, organization: Organization, device_id: uuid.UUID | None = None
) -> IssuedTokens:
    if not Membership.objects.filter(user=user, organization=organization).exists():
        MembershipFactory(user=user, organization=organization)
    return start_device_session(user, organization, DeviceInfo(device_id=device_id or uuid.uuid4()))


def refresh(issued: IssuedTokens, token: str | None = None) -> IssuedTokens:
    return rotate_refresh_token(token or issued.refresh, issued.session.device_id)


def age_consumption(pair: TokenPair, seconds: int) -> None:
    moment = timezone.now() - timedelta(seconds=seconds)
    TokenPair.objects.filter(pk=pair.pk).update(consumed_at=moment, superseded_at=moment)


def fresh(pair: TokenPair) -> TokenPair:
    return TokenPair.objects.select_related("parent").get(pk=pair.pk)


# --- start_device_session ----------------------------------------------------------------------


def test_start_session_stores_only_digests_of_the_tokens(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    row = TokenPair.objects.values().get(pk=issued.pair.pk)

    stored = {str(value) for value in row.values()}
    assert issued.access not in stored
    assert issued.refresh not in stored
    assert row["access_hash"] == hash_token(issued.access)
    assert row["refresh_hash"] == hash_token(issued.refresh)
    assert not hasattr(DeviceSession, "access_hash")  # nothing token-shaped on the session


def test_start_session_registers_the_device_in_the_organization(org_a: Organization) -> None:
    user = UserFactory()
    device_id = uuid.uuid4()

    start_device_session(
        user, org_a, DeviceInfo(device_id=device_id, label="Moto 1", app_version="1.2.3")
    )

    device = Device.objects.get(pk=device_id)
    assert device.organization == org_a
    assert (device.label, device.app_version, device.last_user) == ("Moto 1", "1.2.3", user)
    assert device.last_seen_at is not None


def test_a_second_login_updates_the_device_and_keeps_blank_fields(org_a: Organization) -> None:
    user, device_id = UserFactory(), uuid.uuid4()
    start_device_session(user, org_a, DeviceInfo(device_id=device_id, label="Moto 1"))

    other = UserFactory()
    start_device_session(other, org_a, DeviceInfo(device_id=device_id, app_version="2.0"))

    device = Device.objects.get(pk=device_id)
    assert (device.label, device.app_version, device.last_user) == ("Moto 1", "2.0", other)
    assert Device.objects.count() == 1


def test_device_registered_in_another_organization_is_refused(
    org_a: Organization, org_b: Organization
) -> None:
    device = DeviceFactory(organization=org_b)

    with pytest.raises(DeviceOrganizationMismatchError):
        login(UserFactory(), org_a, device.pk)
    assert not DeviceSession.objects.exists()


def test_revoked_device_cannot_log_in(org_a: Organization) -> None:
    device = DeviceFactory(organization=org_a, is_revoked=True, revoked_at=timezone.now())

    with pytest.raises(DeviceRevokedError):
        login(UserFactory(), org_a, device.pk)


def test_new_login_supersedes_earlier_sessions_of_the_same_user_on_the_device(
    org_a: Organization,
) -> None:
    user, device_id = UserFactory(), uuid.uuid4()
    first = login(user, org_a, device_id)

    second = login(user, org_a, device_id)

    first.session.refresh_from_db()
    assert first.session.revoke_reason == RevokeReason.SUPERSEDED
    assert first.session.final_upload_deadline is None
    assert second.session.revoked_at is None


def test_login_does_not_touch_sessions_of_other_users_on_the_device(org_a: Organization) -> None:
    device_id = uuid.uuid4()
    first = login(UserFactory(), org_a, device_id)

    login(UserFactory(), org_a, device_id)

    first.session.refresh_from_db()
    assert first.session.revoked_at is None


def test_a_session_is_refused_when_the_user_was_deactivated_after_authentication(
    org_a: Organization,
) -> None:
    user = UserFactory()
    User.objects.filter(pk=user.pk).update(is_active=False)  # `user` still says active

    with pytest.raises(InvalidCredentialsError):
        login(user, org_a)
    assert not DeviceSession.objects.exists()


def test_a_session_is_refused_when_the_password_changed_after_authentication(
    org_a: Organization,
) -> None:
    user = UserFactory()
    user.set_password("the password that was verified")
    user.save(update_fields=["password"])
    changed = User.objects.get(pk=user.pk)
    changed.set_password("the password set by a concurrent reset")
    changed.save(update_fields=["password"])

    with pytest.raises(InvalidCredentialsError):
        login(user, org_a)  # `user` carries the old hash, as a login that authenticated first
    assert not DeviceSession.objects.exists()


# --- refresh families ----------------------------------------------------------------------------


def test_rotation_issues_a_child_pair_and_consumes_the_parent(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    rotated = refresh(issued)

    parent, child = fresh(issued.pair), fresh(rotated.pair)
    assert rotated.access != issued.access
    assert rotated.refresh != issued.refresh
    assert child.parent_id == parent.pk
    assert parent.consumed_at is not None
    assert parent.superseded_at == parent.consumed_at
    assert child.consumed_at is None
    assert child.access_hash == hash_token(rotated.access)


def test_the_replaced_access_token_stays_valid_only_for_the_grace_window(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    refresh(issued)
    now = timezone.now()

    assert not is_access_superseded(fresh(issued.pair), now)
    assert is_access_superseded(fresh(issued.pair), now + timedelta(seconds=61))


def test_reusing_r0_after_r1_was_exchanged_revokes_the_session(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)  # R0
    r1 = refresh(issued)
    refresh(r1)  # R2: R1 is consumed

    with pytest.raises(SessionRevokedError):
        refresh(issued)  # R0 again, even inside the window: a later token was exchanged

    session = DeviceSession.objects.get(pk=issued.session.pk)
    assert session.revoke_reason == RevokeReason.REFRESH_REUSE  # committed, not rolled back
    assert session.final_upload_deadline is None


def test_reusing_a_consumed_refresh_outside_the_grace_window_revokes_the_session(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    refresh(issued)
    age_consumption(issued.pair, 120)

    with pytest.raises(SessionRevokedError):
        refresh(issued)

    assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"


def test_a_duplicate_refresh_inside_the_window_issues_a_sibling_and_both_stay_usable(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    first = refresh(issued)  # response lost, or arriving late
    second = refresh(issued)  # the client retries with R0

    assert second.pair.parent_id == first.pair.parent_id == issued.pair.pk
    assert second.refresh != first.refresh
    # Out-of-order responses: the client may hold either pair and it keeps working.
    assert refresh(first).pair.parent_id == first.pair.pk
    assert DeviceSession.objects.get(pk=issued.session.pk).revoked_at is None
    assert fresh(issued.pair).consumed_at is not None


def test_exchanging_a_second_sibling_after_the_first_was_used_revokes_the_session(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    first, second = refresh(issued), refresh(issued)

    refresh(first)  # the first sibling used is the valid one

    with pytest.raises(SessionRevokedError):
        refresh(second)  # exchanging another sibling of the same parent is a copy

    assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"


def test_an_attacker_replaying_r0_after_the_client_used_the_new_access_token_is_caught(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    legit = refresh(issued)
    assert claim_access_use(fresh(legit.pair)) is None  # the phone used A1

    with pytest.raises(SessionRevokedError):
        refresh(issued)  # the attacker presents the stolen R0, still inside the window

    assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"


def test_a_sibling_is_retired_as_soon_as_another_one_was_used(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    winner, loser = refresh(issued), refresh(issued)
    assert claim_access_use(fresh(winner.pair)) is None

    assert is_retired_sibling(fresh(loser.pair))
    assert not is_retired_sibling(fresh(winner.pair))
    with pytest.raises(SessionRevokedError):
        refresh(loser)  # a retired sibling presented to refresh is a copy
    assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"


def test_using_the_access_token_of_a_second_sibling_revokes_the_session(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    winner, loser = refresh(issued), refresh(issued)
    assert claim_access_use(fresh(winner.pair)) is None

    failure = claim_access_use(fresh(loser.pair))

    assert isinstance(failure, SessionRevokedError)
    assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"


def test_the_same_sibling_can_be_used_again(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    winner, _ = refresh(issued), refresh(issued)

    assert claim_access_use(fresh(winner.pair)) is None
    assert claim_access_use(fresh(winner.pair)) is None
    assert DeviceSession.objects.get(pk=issued.session.pk).revoked_at is None


def test_duplicates_beyond_the_sibling_cap_are_throttled_not_revoked(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    for _ in range(MAX_SIBLING_PAIRS):
        refresh(issued)  # the exchange plus accepted duplicates

    with pytest.raises(Throttled) as refused:
        refresh(issued)

    assert 1 <= refused.value.wait <= 60  # until the grace window closes
    assert TokenPair.objects.filter(parent_id=issued.pair.pk).count() == MAX_SIBLING_PAIRS
    assert DeviceSession.objects.get(pk=issued.session.pk).revoked_at is None


def test_past_the_window_the_same_duplicate_is_a_reuse(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    for _ in range(MAX_SIBLING_PAIRS):
        refresh(issued)
    age_consumption(issued.pair, 120)

    with pytest.raises(SessionRevokedError):
        refresh(issued)

    assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"


@pytest.mark.django_db(transaction=True)
def test_first_use_of_a_sibling_and_a_duplicate_refresh_never_adopt_two_pairs(
    org_a: Organization,
) -> None:
    """B's first use races a duplicate refresh of the parent that creates and adopts C."""
    for _ in range(12):
        issued = login(UserFactory(), org_a)
        child_b = refresh(issued)
        results: dict[str, str] = {}
        barrier = threading.Barrier(2)

        def use_b(
            pair: TokenPair = child_b.pair,
            results: dict[str, str] = results,
            barrier: threading.Barrier = barrier,
        ) -> None:
            try:
                barrier.wait(timeout=10)
                failure = claim_access_use(fresh(pair))
                results["b"] = "ok" if failure is None else "revoked"
            finally:
                connection.close()

        def duplicate_then_use_c(
            issued: IssuedTokens = issued,
            results: dict[str, str] = results,
            barrier: threading.Barrier = barrier,
        ) -> None:
            try:
                barrier.wait(timeout=10)
                try:
                    child_c = refresh(issued)
                except SessionRevokedError:
                    results["c"] = "refused"  # B was already used: the duplicate is a copy
                    return
                failure = claim_access_use(fresh(child_c.pair))
                results["c"] = "ok" if failure is None else "revoked"
            finally:
                connection.close()

        threads = [threading.Thread(target=use_b), threading.Thread(target=duplicate_then_use_c)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=60)
        assert not any(thread.is_alive() for thread in threads)

        adopted = TokenPair.objects.filter(parent_id=issued.pair.pk, access_used_at__isnull=False)
        assert adopted.count() <= 1  # never two siblings adopted
        if results["c"] == "revoked" or results["b"] == "revoked":
            assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"
        else:
            assert adopted.count() == 1 or results["c"] == "refused"


@pytest.mark.django_db(transaction=True)
def test_two_siblings_used_at_the_same_time_only_one_wins(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    first, second = refresh(issued), refresh(issued)
    outcomes: list[str] = []
    barrier = threading.Barrier(2)

    def use(pair: TokenPair) -> None:
        try:
            barrier.wait(timeout=10)
            failure = claim_access_use(fresh(pair))
            outcomes.append("ok" if failure is None else "revoked")
        finally:
            connection.close()

    threads = [threading.Thread(target=use, args=(p.pair,)) for p in (first, second)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert sorted(outcomes) == ["ok", "revoked"]
    assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"


def test_siblings_all_stay_valid_after_the_window_when_none_was_used(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    first, second = refresh(issued), refresh(issued)
    age_consumption(issued.pair, 120)

    assert not is_retired_sibling(fresh(first.pair))
    assert not is_retired_sibling(fresh(second.pair))
    assert refresh(second).pair.parent_id == second.pair.pk


@override_settings(AUTH_REFRESH_REUSE_GRACE_SECONDS=0)
def test_grace_can_be_disabled(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    refresh(issued)
    age_consumption(issued.pair, 1)

    with pytest.raises(SessionRevokedError):
        refresh(issued)


def test_unknown_refresh_token_is_invalid(org_a: Organization) -> None:
    with pytest.raises(InvalidTokenError):
        rotate_refresh_token("not-a-real-token", uuid.uuid4())


def test_refresh_with_another_device_id_is_invalid_and_leaves_the_session_alone(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)

    with pytest.raises(InvalidTokenError):
        rotate_refresh_token(issued.refresh, uuid.uuid4())

    assert DeviceSession.objects.get(pk=issued.session.pk).revoked_at is None
    assert fresh(issued.pair).consumed_at is None


def test_expired_refresh_token_is_refused(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    TokenPair.objects.filter(pk=issued.pair.pk).update(
        refresh_expires_at=timezone.now() - timedelta(seconds=1)
    )

    with pytest.raises(TokenExpiredError):
        refresh(issued)


def test_rotation_slides_the_refresh_expiry(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    soon = timezone.now() + timedelta(days=1)
    TokenPair.objects.filter(pk=issued.pair.pk).update(refresh_expires_at=soon)

    rotated = refresh(issued)

    assert fresh(rotated.pair).refresh_expires_at > soon


def test_revoked_session_cannot_refresh(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    revoke_session(issued.session, Revocation(RevokeReason.LOGOUT))

    with pytest.raises(SessionRevokedError):
        refresh(issued)


def test_refresh_of_an_inactive_user_revokes_the_session(org_a: Organization) -> None:
    user = UserFactory()
    issued = login(user, org_a)
    User.objects.filter(pk=user.pk).update(is_active=False)

    with pytest.raises(SessionRevokedError):
        refresh(issued)

    issued.session.refresh_from_db()
    assert issued.session.revoke_reason == RevokeReason.USER_DEACTIVATED


@pytest.mark.parametrize("field", ["membership", "organization"])
def test_refresh_revokes_the_session_when_the_pinned_membership_is_no_longer_active(
    org_a: Organization, field: str
) -> None:
    user = UserFactory()
    issued = login(user, org_a)
    if field == "membership":
        Membership.objects.filter(user=user, organization=org_a).update(is_active=False)
    else:
        Organization.objects.filter(pk=org_a.pk).update(is_active=False)

    with pytest.raises(SessionRevokedError):
        refresh(issued)

    issued.session.refresh_from_db()
    assert issued.session.revoke_reason == RevokeReason.MEMBERSHIP_INACTIVE
    assert issued.session.final_upload_deadline is None


def test_session_of_a_revoked_device_cannot_refresh(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    Device.objects.filter(pk=issued.session.device_id).update(
        is_revoked=True, revoked_at=timezone.now()
    )

    with pytest.raises(SessionRevokedError):
        refresh(issued)


# --- revocation ---------------------------------------------------------------------------------


def test_revoking_a_users_sessions_is_limited_to_the_organization(
    org_a: Organization, org_b: Organization
) -> None:
    user, admin = UserFactory(), UserFactory()
    in_a = login(user, org_a)
    in_b = login(user, org_b)

    count = revoke_user_sessions(
        user, Revocation(RevokeReason.ADMIN_REVOKE, revoked_by=admin), organization=org_a
    )

    in_a.session.refresh_from_db()
    in_b.session.refresh_from_db()
    assert count == 1
    assert (in_a.session.revoke_reason, in_a.session.revoked_by) == ("admin_revoke", admin)
    assert in_b.session.revoked_at is None


def test_revoking_twice_keeps_the_first_reason(org_a: Organization) -> None:
    user = UserFactory()
    issued = login(user, org_a)
    revoke_user_sessions(user, Revocation(RevokeReason.ADMIN_REVOKE))

    again = revoke_user_sessions(user, Revocation(RevokeReason.LOGOUT))

    issued.session.refresh_from_db()
    assert again == 0
    assert issued.session.revoke_reason == RevokeReason.ADMIN_REVOKE


def test_revoke_device_revokes_the_device_and_every_session_on_it(org_a: Organization) -> None:
    admin, device_id = UserFactory(), uuid.uuid4()
    first = login(UserFactory(), org_a, device_id)
    second = login(UserFactory(), org_a, device_id)
    elsewhere = login(UserFactory(), org_a)

    device = revoke_device(Device.objects.get(pk=device_id), admin)

    first.session.refresh_from_db()
    second.session.refresh_from_db()
    elsewhere.session.refresh_from_db()
    assert device.is_revoked
    assert (device.revoked_by, device.revoked_at is not None) == (admin, True)
    assert first.session.revoke_reason == second.session.revoke_reason == "device_revoked"
    assert elsewhere.session.revoked_at is None


def test_revoke_device_is_idempotent(org_a: Organization) -> None:
    admin, device = UserFactory(), DeviceFactory(organization=org_a)
    first = revoke_device(device, admin)

    second = revoke_device(device, UserFactory())

    assert second.revoked_at == first.revoked_at
    assert second.revoked_by == admin


# --- final upload policy -------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("reason", "allow", "has_deadline"),
    [
        (RevokeReason.ADMIN_REVOKE, True, True),
        (RevokeReason.DEVICE_REVOKED, True, True),
        (RevokeReason.ADMIN_REVOKE, False, False),
        (RevokeReason.DEVICE_REVOKED, False, False),
        (RevokeReason.REFRESH_REUSE, True, False),
        (RevokeReason.PASSWORD_CHANGED, True, False),
        (RevokeReason.USER_DEACTIVATED, True, False),
        (RevokeReason.SUPERSEDED, True, False),
        (RevokeReason.MEMBERSHIP_INACTIVE, True, False),
        (RevokeReason.LOGOUT, True, False),
    ],
)
def test_a_final_upload_needs_an_explicit_flag_and_an_admin_or_device_revocation(
    org_a: Organization, reason: RevokeReason, allow: bool, has_deadline: bool
) -> None:
    issued = login(UserFactory(), org_a)

    revoke_session(issued.session, Revocation(reason, allow_final_upload=allow))

    issued.session.refresh_from_db()
    assert (issued.session.final_upload_deadline is not None) is has_deadline


def test_revoking_a_device_without_the_flag_leaves_no_final_upload(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    revoke_device(Device.objects.get(pk=issued.session.device_id), UserFactory())

    issued.session.refresh_from_db()
    assert issued.session.final_upload_deadline is None


@override_settings(AUTH_REVOKED_FINAL_UPLOAD_HOURS=0)
def test_final_upload_can_be_disabled_even_with_the_flag(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True))

    issued.session.refresh_from_db()
    assert issued.session.final_upload_deadline is None


def allowed_revocation() -> Revocation:
    return Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)


def test_final_upload_deadline_follows_the_setting(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    revoke_session(issued.session, allowed_revocation())

    issued.session.refresh_from_db()
    delta = issued.session.final_upload_deadline - issued.session.revoked_at
    assert delta == timedelta(hours=72)


def test_final_upload_is_single_use(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    revoke_session(issued.session, allowed_revocation())

    consume_final_upload(issued.session)

    with pytest.raises(SessionRevokedError):
        consume_final_upload(issued.session)


def test_final_upload_is_refused_after_the_deadline(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    revoke_session(issued.session, allowed_revocation())
    DeviceSession.objects.filter(pk=issued.session.pk).update(
        final_upload_deadline=timezone.now() - timedelta(seconds=1)
    )

    with pytest.raises(SessionRevokedError):
        consume_final_upload(issued.session)


def test_final_upload_is_refused_for_a_session_that_is_not_revoked(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    with pytest.raises(SessionRevokedError):
        consume_final_upload(issued.session)


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_final_uploads_only_one_wins(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    revoke_session(issued.session, allowed_revocation())
    outcomes: list[str] = []
    barrier = threading.Barrier(2)

    def attempt() -> None:
        try:
            barrier.wait(timeout=10)
            consume_final_upload(issued.session)
            outcomes.append("ok")
        except SessionRevokedError:
            outcomes.append("refused")
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert sorted(outcomes) == ["ok", "refused"]


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_refreshes_of_the_same_token_both_end_consistent(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    results: list[str] = []
    barrier = threading.Barrier(2)

    def attempt() -> None:
        try:
            barrier.wait(timeout=10)
            refresh(issued)
            results.append("ok")
        except SessionRevokedError:
            results.append("revoked")
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    # Serialized by the session lock: the second one is a duplicate inside the grace window.
    assert results == ["ok", "ok"]
    assert TokenPair.objects.filter(parent_id=issued.pair.pk).count() == 2
    assert DeviceSession.objects.get(pk=issued.session.pk).revoked_at is None


@pytest.mark.django_db(transaction=True)
def test_claiming_a_sibling_waits_for_the_parent_lock_before_looking_at_siblings(
    org_a: Organization,
) -> None:
    """A duplicate refresh holds the locks and adopts C; B's first use must wait, then revoke.

    Deterministic interleaving: a lock-free decision based on B being the only child would
    adopt B too.
    """
    issued = login(UserFactory(), org_a)
    child_b = refresh(issued)
    holding, release = threading.Event(), threading.Event()
    result: dict[str, object] = {}

    def duplicate_adopting_c() -> None:
        try:
            with transaction.atomic():
                User.objects.select_for_update(no_key=True).get(pk=issued.session.user_id)
                session = DeviceSession.objects.select_for_update().get(pk=issued.session.pk)
                TokenPair.objects.select_for_update().get(pk=issued.pair.pk)
                child_c = issue_pair(session, parent=issued.pair)
                TokenPair.objects.filter(pk=child_c.pair.pk).update(access_used_at=timezone.now())
                holding.set()
                release.wait(timeout=20)
        finally:
            connection.close()

    def use_b() -> None:
        try:
            result["failure"] = claim_access_use(fresh(child_b.pair))
        finally:
            connection.close()

    holder = threading.Thread(target=duplicate_adopting_c)
    holder.start()
    assert holding.wait(timeout=20)
    user = threading.Thread(target=use_b)
    user.start()
    user.join(timeout=1.5)
    assert user.is_alive(), "the claim decided without waiting for the parent lock"
    release.set()
    holder.join(timeout=30)
    user.join(timeout=30)

    assert isinstance(result["failure"], SessionRevokedError)
    adopted = TokenPair.objects.filter(parent_id=issued.pair.pk, access_used_at__isnull=False)
    assert adopted.count() == 1
    assert DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == "refresh_reuse"
