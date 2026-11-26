"""Platform admin: the only cross-organization surface, strictly gated and audited."""

import struct
import zlib
from io import StringIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import DatabaseError, connection, transaction
from rest_framework.test import APIClient

from accounts.models import User
from catalogs.seeds import seed_default_catalogs
from organizations.models import Center, Membership, Organization, Profile
from platform_admin.models import PlatformAdmin, PlatformAuditEntry
from platform_admin.services import grant_platform_admin
from tests.conftest import WIDGET_CODES, MemberFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.django_db

BASE = "/api/v1/platform/organizations/"
REASON = "Contrato terminado por el cliente"


def _payload(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "name": "Programa Norte",
        "slug": "norte",
        "country": "MX",
        "timezone": "America/Monterrey",
        "epi_week": "mmwr",
        "languages": ["es-MX"],
        "centers": [{"code": "C-01", "name": "Base Norte"}],
        "admin_first_name": "Nora",
        "admin_last_name": "Garza",
        "admin_username": "norte-admin",
        "admin_email": "norte-admin@example.test",
        "admin_delivery": "password",
    }
    body.update(overrides)
    return body


@pytest.fixture
def platform_user() -> User:
    user = UserFactory()
    grant_platform_admin(user)
    return user


@pytest.fixture
def platform_client(api_client: APIClient, platform_user: User) -> APIClient:
    api_client.force_login(platform_user)
    return api_client


def _png() -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
        )

    header = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    pixels = zlib.compress(b"\x00\xff\x00\x00")
    return (
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")
    )


# --- Access ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", BASE),
        ("post", BASE),
        ("get", f"{BASE}org-a/"),
        ("post", f"{BASE}org-a/suspend/"),
        ("post", f"{BASE}org-a/reactivate/"),
        ("post", f"{BASE}org-a/centers/"),
        ("post", f"{BASE}org-a/admins/"),
        ("post", f"{BASE}org-a/apply-defaults/"),
        ("get", f"{BASE}org-a/logo/"),
        ("get", "/api/v1/platform/availability/"),
    ],
)
def test_non_platform_users_get_403(
    api_client: APIClient, make_member: MemberFactory, org_a: Organization, method: str, path: str
) -> None:
    # Even an organization admin with every code is not a platform admin.
    user, _ = make_member(org_a, [*WIDGET_CODES, "organization.update", "role.update"])
    api_client.force_login(user)

    response = getattr(api_client, method)(path, {}, format="json")

    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"


def test_anonymous_gets_401(api_client: APIClient) -> None:
    assert api_client.get(BASE).status_code == 401


def test_inactive_platform_role_gets_403(api_client: APIClient, platform_user: User) -> None:
    PlatformAdmin.objects.filter(user=platform_user).update(is_active=False)
    api_client.force_login(platform_user)

    assert api_client.get(BASE).status_code == 403


def test_device_bearer_tokens_are_not_accepted(api_client: APIClient, platform_user: User) -> None:
    api_client.credentials(HTTP_AUTHORIZATION="Bearer whatever")

    assert api_client.get(BASE).status_code == 401


# --- Isolation ---------------------------------------------------------------------------------


def test_platform_admin_without_membership_sees_no_organization_data(
    platform_client: APIClient, org_a: Organization
) -> None:
    me = platform_client.get("/api/v1/me/")
    assert me.status_code == 200
    assert me.data["is_platform_admin"] is True
    assert me.data["organization"] is None
    assert me.data["permissions"] == []

    for path in ("/api/v1/widgets/", "/api/v1/centers/", "/api/v1/organization/"):
        response = platform_client.get(path)
        assert response.status_code == 403
        assert response.data["code"] == "no_active_membership"
    response = platform_client.get("/api/v1/widgets/", HTTP_X_ORGANIZATION="org-a")
    assert response.status_code == 403


def test_platform_admin_with_membership_keeps_only_that_membership_scope(
    api_client: APIClient, make_member: MemberFactory, org_a: Organization, org_b: Organization
) -> None:
    user, _ = make_member(org_a, ["widget.read"])
    grant_platform_admin(user)
    api_client.force_login(user)

    assert api_client.get("/api/v1/widgets/").status_code == 200
    foreign = api_client.get("/api/v1/widgets/", HTTP_X_ORGANIZATION="org-b")
    assert foreign.status_code == 403
    # The platform list is metadata only.
    listed = api_client.get(BASE).data["results"]
    assert {row["slug"] for row in listed} == {"org-a", "org-b"}
    assert set(listed[0]) == {
        "slug",
        "name",
        "country",
        "timezone",
        "is_active",
        "users_count",
        "centers_count",
        "has_logo",
        "created_at",
    }


def test_regular_me_has_platform_flag_false(client_a: APIClient) -> None:
    assert client_a.get("/api/v1/me/").data["is_platform_admin"] is False


def test_user_without_membership_and_without_platform_role_still_gets_403(
    api_client: APIClient,
) -> None:
    api_client.force_login(UserFactory())

    response = api_client.get("/api/v1/me/")

    assert response.status_code == 403
    assert response.data["code"] == "no_active_membership"


# --- Provisioning ------------------------------------------------------------------------------


def test_create_organization_with_defaults_centers_and_admin(
    platform_client: APIClient, platform_user: User
) -> None:
    response = platform_client.post(BASE, _payload(), format="json")

    assert response.status_code == 201, response.data
    assert response["Cache-Control"].startswith("max-age=0")
    password = response.data["admin"]["temporary_password"]
    assert password
    assert len(password) == 19
    organization = Organization.objects.get(slug="norte")
    assert organization.epi_week == "mmwr"
    assert Profile.objects.filter(organization=organization, slug="admin").exists()
    assert Center.objects.filter(organization=organization, code="C-01").count() == 1
    admin = User.objects.get(username="norte-admin")
    assert admin.check_password(password)
    membership = Membership.objects.get(user=admin, organization=organization)
    assert [profile.slug for profile in membership.profiles.all()] == ["admin"]
    assert response.data["organization"]["admins"][0]["username"] == "norte-admin"
    actions = set(
        PlatformAuditEntry.objects.filter(organization=organization).values_list(
            "action", flat=True
        )
    )
    assert actions == {"organization.create", "center.create", "admin.create"}
    # No secret in the audit trail.
    for details in PlatformAuditEntry.objects.values_list("details", flat=True):
        assert password not in str(details)
    # The platform admin did not become a member.
    assert not Membership.objects.filter(user=platform_user).exists()


def test_invite_delivery_sets_no_password(platform_client: APIClient) -> None:
    response = platform_client.post(BASE, _payload(admin_delivery="invite"), format="json")

    assert response.status_code == 201
    assert response.data["admin"]["temporary_password"] is None
    assert not User.objects.get(username="norte-admin").has_usable_password()


def test_existing_username_is_never_taken_over(
    platform_client: APIClient, make_member: MemberFactory, org_a: Organization
) -> None:
    user, _ = make_member(org_a)

    response = platform_client.post(
        BASE, _payload(admin_username=user.username, admin_email=user.email), format="json"
    )

    assert response.status_code == 400
    assert response.data["fields"]["admin_username"][0]["code"] == "username_taken"
    assert not Organization.objects.filter(slug="norte").exists()


def test_duplicate_slug_is_rejected(platform_client: APIClient, org_a: Organization) -> None:
    response = platform_client.post(BASE, _payload(slug="org-a"), format="json")

    assert response.status_code == 400
    assert response.data["fields"]["slug"][0]["code"] == "slug_taken"


@pytest.mark.parametrize(
    "overrides",
    [
        {"slug": "Bad Slug"},
        {"country": "mex"},
        {"timezone": "Mars/Base"},
        {"languages": []},
        {"languages": ["fr"]},
        {"centers": []},
        {"admin_delivery": "sms"},
        {"admin_email": "not-an-email"},
    ],
)
def test_invalid_inputs_are_rejected(
    platform_client: APIClient, overrides: dict[str, object]
) -> None:
    response = platform_client.post(BASE, _payload(**overrides), format="json")

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"


def test_list_and_detail(platform_client: APIClient, org_a: Organization) -> None:
    platform_client.post(BASE, _payload(), format="json")

    listed = platform_client.get(BASE, {"search": "norte"}).data["results"]
    assert [row["slug"] for row in listed] == ["norte"]
    assert listed[0]["users_count"] == 1
    assert listed[0]["centers_count"] == 1
    detail = platform_client.get(f"{BASE}norte/").data
    assert detail["centers"] == [{"code": "C-01", "name": "Base Norte", "is_active": True}]
    assert platform_client.get(f"{BASE}missing/").status_code == 404


# --- Configuration -----------------------------------------------------------------------------


def test_suspend_requires_reason_and_blocks_members(
    platform_client: APIClient, member_a: User, org_a: Organization
) -> None:
    client_a = APIClient()
    client_a.force_authenticate(member_a)
    assert platform_client.post(f"{BASE}org-a/suspend/", {}, format="json").status_code == 400
    assert (
        platform_client.post(
            f"{BASE}org-a/suspend/", {"reason": "corto"}, format="json"
        ).status_code
        == 400
    )

    response = platform_client.post(f"{BASE}org-a/suspend/", {"reason": REASON}, format="json")

    assert response.status_code == 200
    assert response.data["is_active"] is False
    assert response.data["history"][0]["reason"] == REASON
    assert client_a.get("/api/v1/widgets/").status_code == 403
    filtered = platform_client.get(BASE, {"status": "suspended"}).data["results"]
    assert [row["slug"] for row in filtered] == ["org-a"]

    back = platform_client.post(f"{BASE}org-a/reactivate/", {"reason": REASON}, format="json")
    assert back.data["is_active"] is True
    assert client_a.get("/api/v1/widgets/").status_code == 200
    assert PlatformAuditEntry.objects.filter(organization=org_a).count() == 2


def test_add_center_and_admin(platform_client: APIClient, org_a: Organization) -> None:
    seed_default_catalogs(org_a)
    platform_client.post(f"{BASE}org-a/apply-defaults/", format="json")

    center = platform_client.post(
        f"{BASE}org-a/centers/", {"code": "C-9", "name": "Base 9"}, format="json"
    )
    again = platform_client.post(
        f"{BASE}org-a/centers/", {"code": "c-9", "name": "Otra"}, format="json"
    )
    admin = platform_client.post(
        f"{BASE}org-a/admins/",
        {
            "admin_first_name": "Ana",
            "admin_last_name": "Pérez",
            "admin_username": "ana-a",
            "admin_email": "ana-a@example.test",
            "admin_delivery": "password",
        },
        format="json",
    )

    assert center.status_code == 201
    assert again.status_code == 400
    assert admin.status_code == 201
    assert admin.data["temporary_password"]
    detail = platform_client.get(f"{BASE}org-a/").data
    assert "ana-a" in [row["username"] for row in detail["admins"]]


def test_logo_upload_validates_png(platform_client: APIClient, org_a: Organization) -> None:
    bad = SimpleUploadedFile("logo.png", b"<svg/>", content_type="image/png")
    assert (
        platform_client.post(f"{BASE}org-a/logo/", {"logo": bad}, format="multipart").status_code
        == 400
    )

    good = SimpleUploadedFile("logo.png", _png(), content_type="image/png")
    response = platform_client.post(f"{BASE}org-a/logo/", {"logo": good}, format="multipart")

    assert response.status_code == 200
    assert response.data["has_logo"] is True
    served = platform_client.get(f"{BASE}org-a/logo/")
    assert served["Content-Type"] == "image/png"
    assert "no-store" in served["Cache-Control"]


def test_audit_entries_are_insert_only(platform_client: APIClient, org_a: Organization) -> None:
    platform_client.post(f"{BASE}org-a/suspend/", {"reason": REASON}, format="json")
    entry = PlatformAuditEntry.objects.get(organization=org_a)

    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(
            "UPDATE platform_admin_platformauditentry SET details = '{}' WHERE id = %s", [entry.pk]
        )


def test_write_throttle(
    platform_client: APIClient, settings: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    from platform_admin.permissions import PlatformWriteThrottle

    monkeypatch.setattr(PlatformWriteThrottle, "THROTTLE_RATES", {"platform_write": "1/hour"})
    platform_client.post(f"{BASE}missing/suspend/", {"reason": REASON}, format="json")

    response = platform_client.post(f"{BASE}missing/suspend/", {"reason": REASON}, format="json")

    assert response.status_code == 429


def test_create_platform_admin_command() -> None:
    out = StringIO()
    call_command(
        "create_platform_admin",
        "--username",
        "root-ops",
        "--email",
        "root-ops@example.test",
        "--no-password",
        stdout=out,
    )

    user = User.objects.get(username="root-ops")
    assert PlatformAdmin.objects.filter(user=user, is_active=True).exists()
    assert not user.has_usable_password()
    assert not Membership.objects.filter(user=user).exists()
    assert PlatformAuditEntry.objects.filter(action="platform_admin.grant").count() == 1


# --- Security review follow-ups ------------------------------------------------------------


def _created_admin(platform_client: APIClient) -> tuple[User, str]:
    response = platform_client.post(BASE, _payload(), format="json")
    return User.objects.get(username="norte-admin"), response.data["admin"]["temporary_password"]


def test_temporary_password_must_be_changed_before_anything_else(
    platform_client: APIClient,
) -> None:
    admin, password = _created_admin(platform_client)
    assert admin.must_change_password
    client = APIClient()
    client.force_login(admin)

    me = client.get("/api/v1/me/")
    blocked = client.get("/api/v1/organization/")
    changed = client.post(
        "/api/v1/auth/password-change/",
        {"current_password": password, "new_password": "Norte-Nueva-Clave-2026"},
        format="json",
    )
    after = client.get("/api/v1/organization/")

    assert me.status_code == 200
    assert me.data["must_change_password"] is True
    assert blocked.status_code == 403
    assert blocked.data["code"] == "password_change_required"
    assert changed.status_code == 204
    assert after.status_code == 200
    admin.refresh_from_db()
    assert not admin.must_change_password
    assert admin.temporary_password_expires_at is None


def test_password_change_rejects_a_wrong_current_password(platform_client: APIClient) -> None:
    admin, _ = _created_admin(platform_client)
    client = APIClient()
    client.force_login(admin)

    response = client.post(
        "/api/v1/auth/password-change/",
        {"current_password": "wrong-one", "new_password": "Norte-Nueva-Clave-2026"},
        format="json",
    )

    assert response.status_code == 401
    admin.refresh_from_db()
    assert admin.must_change_password


def test_temporary_password_expires(platform_client: APIClient) -> None:
    from datetime import timedelta

    from core.time import server_now

    admin, password = _created_admin(platform_client)
    login = {"username": admin.username, "password": password}
    assert APIClient().post("/api/v1/auth/login/", login, format="json").status_code == 200

    User.objects.filter(pk=admin.pk).update(
        temporary_password_expires_at=server_now() - timedelta(minutes=1)
    )

    response = APIClient().post("/api/v1/auth/login/", login, format="json")
    assert response.status_code == 401
    assert response.data["code"] == "invalid_credentials"


def test_audit_entries_cannot_be_truncated(platform_client: APIClient, org_a: Organization) -> None:
    platform_client.post(f"{BASE}org-a/suspend/", {"reason": REASON}, format="json")

    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("TRUNCATE platform_admin_platformauditentry CASCADE")
    assert PlatformAuditEntry.objects.count() >= 1


def test_revoke_platform_admin_command(platform_client: APIClient, platform_user: User) -> None:
    call_command("revoke_platform_admin", "--username", platform_user.username, stdout=StringIO())

    assert not PlatformAdmin.objects.get(user=platform_user).is_active
    assert PlatformAuditEntry.objects.filter(
        action="platform_admin.revoke", target_id=platform_user.pk
    ).exists()
    assert platform_client.get(BASE).status_code == 403
    # Running it again is a no-op: one revoke receipt.
    call_command("revoke_platform_admin", "--username", platform_user.username, stdout=StringIO())
    assert PlatformAuditEntry.objects.filter(action="platform_admin.revoke").count() == 1


def test_suspension_revokes_member_sessions(
    platform_client: APIClient, platform_user: User, member_a: User, org_a: Organization
) -> None:
    from django.contrib.sessions.models import Session

    from accounts.models import DeviceSession
    from tests.factories import DeviceSessionFactory

    device_session = DeviceSessionFactory(organization=org_a, user=member_a)
    web = APIClient()
    web.force_login(member_a)
    sessions_before = Session.objects.count()

    platform_client.post(f"{BASE}org-a/suspend/", {"reason": REASON}, format="json")

    assert DeviceSession.objects.get(pk=device_session.pk).revoked_at is not None
    assert Session.objects.count() == sessions_before - 1  # the actor keeps its own session
    assert web.get("/api/v1/me/").status_code == 401
    assert platform_client.get(BASE).status_code == 200
