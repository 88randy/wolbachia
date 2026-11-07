"""Retention is the sole physical-delete exception for ended token families (#54)."""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from django.conf import settings
from django.db import connection

from accounts import token_retention
from accounts.exceptions import InvalidTokenError
from accounts.models import Device, DeviceSession, RevokeReason, TokenPair, User
from accounts.tasks import prune_ended_token_pairs
from accounts.token_pairs import rotate_refresh_token
from accounts.tokens import generate_token, hash_token
from organizations.models import Organization
from tests.factories import DeviceSessionFactory, TokenPairFactory, WidgetFactory
from tests.test_settings import run_python
from tests.testapp.models import Widget

NOW = datetime(2026, 11, 4, 12, tzinfo=UTC)
CUTOFF = NOW - timedelta(days=90)
OLD = CUTOFF - timedelta(days=10)


def test_end_proof_keeps_real_expiry_and_unknown_cutover_separate(settings):
    from types import SimpleNamespace

    from accounts.session_audit_retention import end_proof

    settings.AUTH_REVOKED_FINAL_UPLOAD_HOURS = 72
    session = SimpleNamespace(revoked_at=None, final_upload_deadline=None, revoke_reason="")
    expired = end_proof(session, OLD, NOW)
    assert (expired.ended_at, expired.retention_anchor, expired.end_basis, expired.end_reason) == (
        OLD,
        OLD,
        "token_expiry",
        "expired",
    )
    unknown = end_proof(session, None, NOW)
    assert (unknown.ended_at, unknown.retention_anchor, unknown.end_basis, unknown.end_reason) == (
        None,
        NOW,
        "legacy_empty",
        "unknown",
    )
    session.revoked_at, session.revoke_reason = OLD, RevokeReason.ADMIN_REVOKE
    session.final_upload_deadline = OLD + timedelta(days=5)
    revoked = end_proof(session, None, NOW)
    assert revoked.ended_at == revoked.retention_anchor == session.final_upload_deadline
    assert revoked.end_basis == "revocation_window"
    assert revoked.end_reason == RevokeReason.ADMIN_REVOKE
    session.final_upload_deadline = None
    assert end_proof(session, None, NOW).ended_at == OLD + timedelta(hours=72)


@pytest.fixture
def retention_clock(monkeypatch, settings):
    settings.AUTH_TOKEN_PAIR_RETENTION_DAYS = 90
    monkeypatch.setattr(token_retention, "server_now", lambda: NOW)
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)


def ended_session(**fields):
    return DeviceSessionFactory(revoked_at=OLD, revoke_reason=RevokeReason.LOGOUT, **fields)


def expired_pair(**fields):
    return TokenPairFactory(**{"access_expires_at": OLD, "refresh_expires_at": OLD, **fields})


@pytest.mark.django_db
def test_prunes_whole_chains_and_siblings_but_keeps_audit_and_business_rows(
    retention_clock, caplog
):
    sessions = [ended_session(), ended_session()]
    for session in sessions:
        parent = TokenPairFactory(session=session)
        TokenPairFactory(session=session, parent=parent)
        for _ in range(40):
            parent = TokenPairFactory(session=session, parent=parent)
        WidgetFactory(organization=session.organization)
    active = DeviceSessionFactory(organization=sessions[0].organization)
    ancient = expired_pair(session=active)
    live = expired_pair(session=active, refresh_expires_at=NOW + timedelta(days=1))
    audit_before = list(DeviceSession.objects.order_by("pk").values())
    retained_counts = [model.objects.count() for model in (User, Device, Organization, Widget)]

    with caplog.at_level(logging.INFO, logger="accounts.auth"):
        result = token_retention.prune_ended_token_pairs()
        repeated = token_retention.prune_ended_token_pairs()

    assert (result.sessions_pruned, result.pairs_deleted) == (2, 84)
    assert (repeated.sessions_pruned, repeated.pairs_deleted) == (0, 0)
    assert set(TokenPair.objects.values_list("pk", flat=True)) == {ancient.pk, live.pk}
    connection.check_constraints()  # Validate the self-FK even inside pytest's outer transaction.
    audit_after = list(DeviceSession.objects.order_by("pk").values())
    proof_fields = {"ended_at", "end_basis", "end_reason", "retention_anchor"}
    assert [
        {key: value for key, value in row.items() if key not in proof_fields} for row in audit_after
    ] == [
        {key: value for key, value in row.items() if key not in proof_fields}
        for row in audit_before
    ]
    for session in sessions:
        session.refresh_from_db()
        assert session.ended_at == session.retention_anchor == OLD + timedelta(hours=72)
        assert (session.end_basis, session.end_reason) == ("revocation_window", "logout")
    active.refresh_from_db()
    assert active.end_basis == ""
    assert active.ended_at is None
    assert [
        model.objects.count() for model in (User, Device, Organization, Widget)
    ] == retained_counts
    assert [record.getMessage() for record in caplog.records] == [
        "event=token_pairs_pruned sessions_pruned=2 pairs_deleted=84",
        "event=token_pairs_pruned sessions_pruned=0 pairs_deleted=0",
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("offset", [timedelta(0), timedelta(microseconds=1)])
@pytest.mark.parametrize("deadline", [None, OLD])
def test_revocation_at_or_inside_cutoff_keeps_family(retention_clock, offset, deadline):
    session = DeviceSessionFactory(
        revoked_at=CUTOFF + offset,
        revoke_reason=RevokeReason.LOGOUT,
        final_upload_deadline=deadline,
    )
    pair = expired_pair(session=session)

    token_retention.prune_ended_token_pairs()

    assert TokenPair.objects.filter(pk=pair.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("revoked_at", "kept"),
    [(CUTOFF - timedelta(hours=72), True), (CUTOFF - timedelta(hours=72, seconds=1), False)],
)
def test_cancelled_final_upload_window_still_delays_retention(retention_clock, revoked_at, kept):
    """A password reset clears the deadline; the family keeps the configured window after revoke."""
    session = DeviceSessionFactory(
        revoked_at=revoked_at, revoke_reason=RevokeReason.ADMIN_REVOKE, final_upload_deadline=None
    )
    pair = expired_pair(session=session)

    token_retention.prune_ended_token_pairs()

    assert TokenPair.objects.filter(pk=pair.pk).exists() == kept


@pytest.mark.django_db
@pytest.mark.parametrize("is_used", [False, True])
@pytest.mark.parametrize("deadline", [NOW + timedelta(days=1), CUTOFF, OLD])
def test_final_upload_deadline_delays_retention_even_when_used(retention_clock, is_used, deadline):
    session = ended_session(
        final_upload_deadline=deadline,
        final_upload_used_at=OLD if is_used else None,
    )
    pair = TokenPairFactory(session=session)

    token_retention.prune_ended_token_pairs()

    assert TokenPair.objects.filter(pk=pair.pk).exists() == (deadline >= CUTOFF)


@pytest.mark.django_db
@pytest.mark.parametrize("expiry_field", ["access_expires_at", "refresh_expires_at"])
@pytest.mark.parametrize("latest_expiry", [NOW + timedelta(days=1), NOW, CUTOFF, OLD])
def test_unrevoked_family_uses_latest_expiry_of_either_token(
    retention_clock, expiry_field, latest_expiry
):
    session = DeviceSessionFactory()
    root = expired_pair(session=session, **{expiry_field: latest_expiry})
    expired_pair(session=session, parent=root)

    token_retention.prune_ended_token_pairs()

    assert session.token_pairs.count() == (2 if latest_expiry >= CUTOFF else 0)


@pytest.mark.django_db
def test_configured_retention_is_used(retention_clock, settings):
    settings.AUTH_TOKEN_PAIR_RETENTION_DAYS = 365
    pair = TokenPairFactory(session=ended_session())

    result = token_retention.prune_ended_token_pairs()

    assert result.pairs_deleted == 0
    assert TokenPair.objects.filter(pk=pair.pk).exists()


@pytest.mark.django_db
def test_batch_cap_leaves_remaining_families_for_next_run(retention_clock, monkeypatch):
    monkeypatch.setattr(token_retention, "MAX_SESSIONS_PER_RUN", 2)
    for _ in range(3):
        TokenPairFactory(session=ended_session())
    ended_session(id=UUID(int=0))  # Sorted first: an empty family must not consume the cap.

    first = token_retention.prune_ended_token_pairs()
    remaining = TokenPair.objects.count()
    second = token_retention.prune_ended_token_pairs()

    assert (first.sessions_pruned, remaining, second.sessions_pruned) == (2, 1, 1)
    assert not TokenPair.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("change", ["revoke", "refresh", "final_upload"])
def test_locked_recheck_skips_a_family_changed_after_candidate_selection(
    retention_clock, monkeypatch, change
):
    pair = expired_pair()
    prune_session = token_retention._prune_session

    def change_before_lock(session_id, cutoff):
        if change == "revoke":
            DeviceSession.objects.filter(pk=session_id).update(
                revoked_at=NOW, revoke_reason=RevokeReason.ADMIN_REVOKE
            )
        elif change == "refresh":
            TokenPairFactory(session=pair.session, parent=pair)
        else:
            DeviceSession.objects.filter(pk=session_id).update(
                revoked_at=OLD,
                revoke_reason=RevokeReason.ADMIN_REVOKE,
                final_upload_deadline=NOW + timedelta(days=1),
            )
        return prune_session(session_id, cutoff)

    monkeypatch.setattr(token_retention, "_prune_session", change_before_lock)

    result = token_retention.prune_ended_token_pairs()

    assert (result.sessions_pruned, result.pairs_deleted) == (0, 0)
    assert TokenPair.objects.filter(pk=pair.pk).exists()


@pytest.mark.django_db
def test_pruned_tokens_answer_like_unknown_tokens(retention_clock, api_client):
    access, refresh = generate_token(), generate_token()
    session = ended_session()
    TokenPairFactory(
        session=session, access_hash=hash_token(access), refresh_hash=hash_token(refresh)
    )
    token_retention.prune_ended_token_pairs()

    for token in (refresh, generate_token()):
        response = api_client.post(
            "/api/v1/auth/refresh/",
            {"refresh": token, "device_id": str(session.device_id)},
            format="json",
        )
        assert (response.status_code, response.data["code"]) == (401, "invalid_token")
        assert response["WWW-Authenticate"] == "Bearer"
    for token in (access, generate_token()):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = api_client.get("/api/v1/me/")
        assert (response.status_code, response.data["code"]) == (401, "invalid_token")
        assert response["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("value", ["29", "366", "not-an-int"])
def test_retention_setting_rejects_invalid_values_at_startup(value):
    result = run_python(
        "import config.settings.test",
        {
            "DJANGO_SETTINGS_MODULE": "config.settings.test",
            "DJANGO_READ_DOT_ENV_FILE": "false",
            "AUTH_TOKEN_PAIR_RETENTION_DAYS": value,
        },
    )

    assert result.returncode != 0
    assert "ImproperlyConfigured" in result.stderr
    assert "AUTH_TOKEN_PAIR_RETENTION_DAYS" in result.stderr


@pytest.mark.parametrize("value", [None, "30", "365"])
def test_retention_setting_defaults_and_inclusive_limits(value):
    environment = {
        "DJANGO_SETTINGS_MODULE": "config.settings.test",
        "DJANGO_READ_DOT_ENV_FILE": "false",
    }
    if value is not None:
        environment["AUTH_TOKEN_PAIR_RETENTION_DAYS"] = value
    result = run_python(
        "from config.settings.test import AUTH_TOKEN_PAIR_RETENTION_DAYS; "
        "print(AUTH_TOKEN_PAIR_RETENTION_DAYS)",
        environment,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == (value or "90")


def test_nightly_schedule_dispatches_registered_ignored_result_task(monkeypatch):
    entry = settings.CELERY_BEAT_SCHEDULE["prune-ended-token-pairs"]
    assert entry["task"] == prune_ended_token_pairs.name == "accounts.tasks.prune_ended_token_pairs"
    schedule = entry["schedule"]
    assert (schedule.hour, schedule.minute, schedule.day_of_week) == ({3}, {30}, set(range(7)))
    assert schedule.day_of_month == set(range(1, 32))
    assert schedule.month_of_year == set(range(1, 13))
    assert settings.CELERY_TIMEZONE == "UTC"
    assert prune_ended_token_pairs.ignore_result
    calls = []
    monkeypatch.setattr("accounts.tasks.prune_token_pairs", lambda: calls.append("pruned"))
    monkeypatch.setattr(
        "accounts.tasks.dissociate_ended_sessions", lambda: calls.append("dissociated")
    )

    prune_ended_token_pairs.run()

    assert calls == ["pruned", "dissociated"]


def test_finite_hold_requires_explicit_purpose_and_90_day_bound():
    from uuid import uuid4

    from accounts.session_audit_retention import HoldRequest, validate_hold

    request = HoldRequest(
        uuid4(), uuid4(), "security_investigation", uuid4(), NOW + timedelta(days=90)
    )
    validate_hold(request, NOW)
    from dataclasses import replace

    for until in (NOW, NOW + timedelta(days=90, microseconds=1), NOW.replace(tzinfo=None)):
        with pytest.raises(ValueError, match="future instant within 90 days"):
            validate_hold(replace(request, until=until), NOW)
    with pytest.raises(ValueError, match="explicit security-investigation"):
        validate_hold(replace(request, purpose="general_retention"), NOW)


def test_audit_retention_setting_refuses_shorter_or_invalid_periods():
    for value, token_days, accepted in (
        ("179", "90", False),
        ("180", "365", False),
        ("invalid", "90", False),
        ("180", "30", True),
        (None, "90", True),
    ):
        environment = {
            "DJANGO_READ_DOT_ENV_FILE": "false",
            "AUTH_TOKEN_PAIR_RETENTION_DAYS": token_days,
        }
        if value is not None:
            environment["AUTH_SESSION_AUDIT_RETENTION_DAYS"] = value
        result = run_python(
            "from config.settings.test import AUTH_SESSION_AUDIT_RETENTION_DAYS; print(AUTH_SESSION_AUDIT_RETENTION_DAYS)",
            environment,
        )
        assert (result.returncode == 0) is accepted
        if accepted:
            assert result.stdout.strip() == (value or "365")
        else:
            assert "AUTH_SESSION_AUDIT_RETENTION_DAYS" in result.stderr


@pytest.mark.django_db
def test_audit_unlinks_direct_people_once_but_keeps_device_business_and_exact_boundary(
    retention_clock, settings, monkeypatch
):
    from uuid import uuid4

    from accounts import session_audit_retention as audit
    from accounts.revocation import revoke_device
    from accounts.services import touch_session
    from tests.factories import UserFactory

    settings.AUTH_SESSION_AUDIT_RETENTION_DAYS = 365
    user, current_user = UserFactory(), UserFactory()
    # Genuine old token families, with the same principal also present in both audit actor fields.
    sessions = []
    for age in (500, 365, 100, 500):
        session = ended_session(
            user=user,
            created_by=user,
            revoked_by=user,
            revoked_at=NOW - timedelta(days=age, hours=72),
        )
        expired_pair(session=session)
        sessions.append(session)
    old, exact, recent, held = sessions
    device = old.device
    device.last_user = current_user
    device.save(update_fields=["last_user"])
    business = WidgetFactory(organization=old.organization, created_by=user)
    audit.change_session_hold(
        audit.HoldRequest(
            held.organization_id,
            held.pk,
            "security_investigation",
            uuid4(),
            NOW + timedelta(days=1),
        ),
        apply=True,
    )
    token_retention.prune_ended_token_pairs()
    before_device = Device.objects.filter(pk=device.pk).values().get()
    before_business = Widget.objects.filter(pk=business.pk).values().get()
    stale = DeviceSession.objects.get(pk=old.pk)
    first = audit.dissociate_ended_sessions()
    assert (first.sessions_dissociated, first.candidates_checked, first.skipped_after_lock) == (
        1,
        1,
        0,
    )
    assert audit.dissociate_ended_sessions().sessions_dissociated == 0
    old.refresh_from_db()
    assert (old.user_id, old.created_by_id, old.revoked_by_id, old.last_used_at) == (
        None,
        None,
        None,
        None,
    )
    assert old.ended_at == old.retention_anchor == NOW - timedelta(days=500)
    assert old.dissociated_at == NOW
    assert old.end_reason == "logout"
    assert Device.objects.filter(pk=device.pk).values().get() == before_device
    assert Widget.objects.filter(pk=business.pk).values().get() == before_business
    assert all(
        DeviceSession.objects.get(pk=session.pk).user_id == user.pk
        for session in (exact, recent, held)
    )
    touch_session(stale)
    old.refresh_from_db()
    assert old.last_used_at is None
    assert Device.objects.filter(pk=device.pk).values().get() == before_device
    revoke_device(device, current_user)
    old.refresh_from_db()
    assert old.revoked_by_id is None
    monkeypatch.setattr(audit, "MAX_AUDITS_PER_RUN", 1)
    monkeypatch.setattr(audit, "server_now", lambda: NOW + timedelta(days=1))
    assert audit.dissociate_ended_sessions().sessions_dissociated == 1
    assert audit.dissociate_ended_sessions().sessions_dissociated == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("first", ["hold", "dissociate"])
def test_hold_and_dissociation_keep_the_same_session_lock_until_commit(
    retention_clock, monkeypatch, first
):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event, get_ident
    from uuid import uuid4

    from django.db import DatabaseError, connections, transaction
    from django.db.models.query import QuerySet

    from accounts import session_audit_retention as audit

    session = ended_session(revoked_at=NOW - timedelta(days=500))
    expired_pair(session=session)
    token_retention.prune_ended_token_pairs()
    request = audit.HoldRequest(
        session.organization_id,
        session.pk,
        "security_investigation",
        uuid4(),
        NOW + timedelta(days=1),
    )
    entered, release = Event(), Event()
    winner = {"thread": None}
    update = QuerySet.update

    def retain_after_real_write(rows, **fields):
        result = update(rows, **fields)
        if rows.model is DeviceSession and get_ident() == winner["thread"]:
            entered.set()
            assert release.wait(5), "Winner release was not observed"
        return result

    def run_winner():
        connections.close_all()
        winner["thread"] = get_ident()
        try:
            return (
                audit.change_session_hold(request, apply=True)
                if first == "hold"
                else audit.dissociate_ended_sessions()
            )
        finally:
            connections.close_all()

    monkeypatch.setattr(QuerySet, "update", retain_after_real_write)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(run_winner)
        try:
            assert entered.wait(5), "Winner never completed its real session update"
            with pytest.raises(DatabaseError) as blocked, transaction.atomic():
                DeviceSession.objects.select_for_update(nowait=True).get(pk=session.pk)
            assert blocked.value.__cause__.sqlstate == "55P03"
        finally:
            release.set()
        future.result()
    if first == "hold":
        assert audit.dissociate_ended_sessions().sessions_dissociated == 0
        assert DeviceSession.objects.get(pk=session.pk).user_id is not None
    else:
        with pytest.raises(ValueError, match="cannot be held"):
            audit.change_session_hold(request, apply=True)
        assert DeviceSession.objects.get(pk=session.pk).user_id is None


@pytest.mark.django_db
def test_refresh_racing_with_prune_answers_unknown_token(retention_clock, monkeypatch):
    refresh = generate_token()
    session = ended_session()
    TokenPairFactory(session=session, refresh_hash=hash_token(refresh))
    lock_user = User.objects.select_for_update

    def prune_after_digest_lookup(**options):
        token_retention.prune_ended_token_pairs()
        return lock_user(**options)

    monkeypatch.setattr(User.objects, "select_for_update", prune_after_digest_lookup)

    with pytest.raises(InvalidTokenError):
        rotate_refresh_token(refresh, session.device_id)
