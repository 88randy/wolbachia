"""Device registry and remote revoke (ADM): `/devices/` and `/users/{id}/revoke-device-sessions/`."""

import uuid

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Device, RevokeReason, User
from accounts.permissions import ADMIN_AUTH_PERMISSION_CODES
from accounts.services import DeviceInfo, start_device_session
from organizations.defaults import DEFAULT_PROFILE_PERMISSIONS
from organizations.models import Membership, Organization, Profile, all_scope
from organizations.services import (
    AdminSpec,
    OrganizationSpec,
    bootstrap_organization,
)
from tests.conftest import MemberFactory
from tests.factories import DeviceFactory, MembershipFactory, UserFactory

pytestmark = pytest.mark.django_db

DEVICES = "/api/v1/devices/"
ME = "/api/v1/me/"


def admin_client(
    api_client: APIClient, org: Organization, make_member: MemberFactory, *codes: str
) -> APIClient:
    user, membership = make_member(org, codes or ADMIN_AUTH_PERMISSION_CODES)
    membership.scope = all_scope()
    membership.save(update_fields=["scope"])
    membership.profiles.update(scope=all_scope())
    api_client.force_authenticate(user)
    return api_client


def phone_session(user: User, org: Organization, device_id: uuid.UUID | None = None):
    Membership.objects.get_or_create(user=user, organization=org)
    return start_device_session(user, org, DeviceInfo(device_id=device_id or uuid.uuid4()))


def revoke_url(user: User) -> str:
    return f"/api/v1/users/{user.pk}/revoke-device-sessions/"


# --- list and retrieve --------------------------------------------------------------------------


def test_list_returns_only_the_devices_of_the_active_organization(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    mine = DeviceFactory(organization=org_a)
    DeviceFactory(organization=org_b)
    client = admin_client(api_client, org_a, make_member)

    response = client.get(DEVICES)

    assert response.status_code == 200
    assert set(response.data) == {"count", "next", "previous", "results"}
    assert [row["id"] for row in response.data["results"]] == [str(mine.pk)]
    assert "organization" not in response.data["results"][0]


def test_list_exposes_last_user_and_revocation_state(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user = UserFactory()
    phone_session(user, org_a)
    client = admin_client(api_client, org_a, make_member)

    row = client.get(DEVICES).data["results"][0]

    assert str(row["last_user"]) == str(user.pk)
    assert row["last_user_username"] == user.username
    assert (row["is_revoked"], row["revoked_at"], row["revoked_by"]) == (False, None, None)
    assert row["last_seen_at"] is not None


def test_list_filters_by_revocation_state(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    active = DeviceFactory(organization=org_a)
    revoked = DeviceFactory(organization=org_a, is_revoked=True, revoked_at=timezone.now())
    client = admin_client(api_client, org_a, make_member)

    only_revoked = client.get(DEVICES, {"is_revoked": "true"}).data["results"]
    only_active = client.get(DEVICES, {"is_revoked": "false"}).data["results"]
    everything = client.get(DEVICES).data["results"]

    assert [row["id"] for row in only_revoked] == [str(revoked.pk)]
    assert [row["id"] for row in only_active] == [str(active.pk)]
    assert len(everything) == 2


def test_list_filters_by_user(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    ana, luis = UserFactory(), UserFactory()
    ana_phone = phone_session(ana, org_a).session.device
    phone_session(luis, org_a)
    client = admin_client(api_client, org_a, make_member)

    rows = client.get(DEVICES, {"user": str(ana.pk)}).data["results"]

    assert [row["id"] for row in rows] == [str(ana_phone.pk)]


def test_internal_audit_hold_query_and_current_device_user_keep_separate_purposes(
    api_client, org_a, org_b, make_member, monkeypatch
):
    import json
    from datetime import UTC, datetime, timedelta
    from io import StringIO

    from accounts.models import DeviceSession
    from accounts.session_audit_retention import dissociate_ended_sessions
    from accounts.token_retention import prune_ended_token_pairs

    now = datetime(2026, 11, 4, 12, tzinfo=UTC)
    clock = {"now": now - timedelta(days=500)}
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock["now"])
    ana, luis = UserFactory(), UserFactory()
    old = phone_session(ana, org_a).session
    clock["now"] = now
    current = phone_session(luis, org_a, old.device_id).session
    prune_ended_token_pairs()
    reference = uuid.uuid4()
    args = ["--organization", str(org_a.pk), "--session", str(old.pk)]
    hold_args = [*args, "--purpose", "security_investigation", "--reference", str(reference)]
    out = StringIO()
    call_command(
        "session_audit_hold",
        *hold_args,
        "--until",
        (now + timedelta(days=1)).isoformat(),
        stdout=out,
    )
    assert json.loads(out.getvalue())["applied"] is False
    assert DeviceSession.objects.get(pk=old.pk).hold_until is None
    call_command(
        "session_audit_hold",
        *hold_args,
        "--until",
        (now + timedelta(days=1)).isoformat(),
        "--apply",
        stdout=StringIO(),
    )
    assert dissociate_ended_sessions().sessions_dissociated == 0
    call_command("session_audit_hold", *hold_args, "--release", "--apply", stdout=StringIO())
    assert dissociate_ended_sessions().sessions_dissociated == 1
    out = StringIO()
    call_command("session_audit", *args, "--state", "dissociated", stdout=out)
    audit = json.loads(out.getvalue())
    assert set(audit) == {
        "state",
        "organization_id",
        "session_id",
        "device_id",
        "end_basis",
        "end_reason",
        "ended_at",
        "retention_anchor",
        "dissociated_at",
    }
    assert audit["state"] == "dissociated"
    assert audit["session_id"] == str(old.pk)
    for query in (
        ["--organization", str(org_b.pk), "--session", str(old.pk)],
        ["--organization", str(org_a.pk), "--session", str(uuid.uuid4())],
    ):
        with pytest.raises(CommandError, match="Unknown organization/session pair"):
            call_command("session_audit", *query, stdout=StringIO())
    with pytest.raises(CommandError, match="dissociated"):
        call_command(
            "session_audit_hold",
            *hold_args,
            "--until",
            (now + timedelta(days=1)).isoformat(),
            "--apply",
            stdout=StringIO(),
        )
    client = admin_client(api_client, org_a, make_member)
    assert client.get(DEVICES, {"user": str(ana.pk)}).data["results"] == []
    row = client.get(f"{DEVICES}{old.device_id}/").json()
    assert row["last_user"] == str(luis.pk)
    current.refresh_from_db()
    assert current.user_id == luis.pk
    assert current.dissociated_at is None


@pytest.mark.parametrize("query", [{"user": "nope"}, {"is_revoked": "maybe"}])
def test_list_rejects_malformed_filters(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory, query: dict[str, str]
) -> None:
    client = admin_client(api_client, org_a, make_member)

    response = client.get(DEVICES, query)

    assert (response.status_code, response.data["code"]) == (400, "validation_error")


def test_retrieve_of_another_organizations_device_is_404(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    foreign = DeviceFactory(organization=org_b)
    own = DeviceFactory(organization=org_a)
    client = admin_client(api_client, org_a, make_member)

    assert client.get(f"{DEVICES}{foreign.pk}/").status_code == 404
    assert client.get(f"{DEVICES}{own.pk}/").status_code == 200


def test_the_device_endpoints_need_their_permission_codes(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    device = DeviceFactory(organization=org_a)
    client = admin_client(api_client, org_a, make_member, "ovitrap.read")

    assert client.get(DEVICES).status_code == 403
    assert client.get(f"{DEVICES}{device.pk}/").status_code == 403
    assert client.post(f"{DEVICES}{device.pk}/revoke/").status_code == 403


def test_reading_devices_does_not_allow_revoking_them(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    device = DeviceFactory(organization=org_a)
    client = admin_client(api_client, org_a, make_member, "device.read")

    assert client.get(DEVICES).status_code == 200
    assert client.post(f"{DEVICES}{device.pk}/revoke/").status_code == 403
    assert not Device.objects.get(pk=device.pk).is_revoked


def test_devices_require_authentication(api_client: APIClient) -> None:
    assert api_client.get(DEVICES).status_code == 401


def test_devices_cannot_be_created_changed_or_deleted_through_the_api(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    device = DeviceFactory(organization=org_a)
    client = admin_client(api_client, org_a, make_member)
    detail = f"{DEVICES}{device.pk}/"

    assert client.post(DEVICES, {}, format="json").status_code == 405
    assert client.patch(detail, {"label": "x"}, format="json").status_code == 405
    assert client.delete(detail).status_code == 405
    assert client.options(DEVICES).status_code == 403


# --- revoke a device ----------------------------------------------------------------------------


def test_revoking_a_device_blocks_its_sessions_and_new_logins(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    courier = UserFactory()
    phone = phone_session(courier, org_a)
    other_phone = phone_session(UserFactory(), org_a)
    client = admin_client(api_client, org_a, make_member)

    response = client.post(f"{DEVICES}{phone.session.device_id}/revoke/")

    assert response.status_code == 200
    assert response.data["is_revoked"] is True
    assert response.data["revoked_at"] is not None
    phone.session.refresh_from_db()
    other_phone.session.refresh_from_db()
    assert phone.session.revoke_reason == RevokeReason.DEVICE_REVOKED
    assert phone.session.final_upload_deadline is None  # no flag, no final upload
    assert other_phone.session.revoked_at is None
    on_phone = APIClient()
    on_phone.credentials(HTTP_AUTHORIZATION=f"Bearer {phone.access}")
    assert on_phone.get(ME).data["code"] == "session_revoked"


def test_a_revoked_device_cannot_log_in_again(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user = UserFactory()
    user.set_password("pw-for-this-test-123")
    user.save(update_fields=["password"])
    make_member(org_a, [], user=user)
    phone = phone_session(user, org_a)
    admin_client(api_client, org_a, make_member).post(f"{DEVICES}{phone.session.device_id}/revoke/")

    response = APIClient().post(
        "/api/v1/auth/login/",
        {
            "username": user.username,
            "password": "pw-for-this-test-123",
            "device_id": str(phone.session.device_id),
        },
        format="json",
    )

    assert (response.status_code, response.data["code"]) == (403, "device_revoked")


def test_revoking_twice_is_idempotent(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    device = DeviceFactory(organization=org_a)
    client = admin_client(api_client, org_a, make_member)
    first = client.post(f"{DEVICES}{device.pk}/revoke/").data

    second = client.post(f"{DEVICES}{device.pk}/revoke/")

    assert second.status_code == 200
    assert second.data["revoked_at"] == first["revoked_at"]


def test_revoking_another_organizations_device_is_404_and_changes_nothing(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    foreign = DeviceFactory(organization=org_b)
    client = admin_client(api_client, org_a, make_member)

    response = client.post(f"{DEVICES}{foreign.pk}/revoke/")

    assert response.status_code == 404
    assert not Device.objects.get(pk=foreign.pk).is_revoked


# --- revoke a user's device sessions ------------------------------------------------------------


def test_admin_revokes_all_device_sessions_of_a_user_in_the_organization(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    courier, _ = make_member(org_a, [])
    MembershipFactory(user=courier, organization=org_b)
    first, second = phone_session(courier, org_a), phone_session(courier, org_a)
    elsewhere = phone_session(courier, org_b)
    admin = admin_client(api_client, org_a, make_member)

    response = admin.post(revoke_url(courier))

    assert (response.status_code, response.data) == (200, {"revoked_sessions": 2})
    for issued in (first, second):
        issued.session.refresh_from_db()
        assert issued.session.revoke_reason == RevokeReason.ADMIN_REVOKE
        assert issued.session.final_upload_deadline is None
    elsewhere.session.refresh_from_db()
    assert elsewhere.session.revoked_at is None


def test_the_next_request_with_a_revoked_access_token_is_session_revoked(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    courier, _ = make_member(org_a, [])
    issued = phone_session(courier, org_a)
    phone = APIClient()
    phone.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    assert phone.get(ME).status_code == 200

    admin_client(api_client, org_a, make_member).post(revoke_url(courier))

    response = phone.get(ME)
    assert (response.status_code, response.data["code"]) == (401, "session_revoked")


def test_revoking_sessions_needs_the_permission_code(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    courier, _ = make_member(org_a, [])
    issued = phone_session(courier, org_a)
    client = admin_client(api_client, org_a, make_member, "device.read", "device.revoke")

    response = client.post(revoke_url(courier))

    assert response.status_code == 403
    issued.session.refresh_from_db()
    assert issued.session.revoked_at is None


def test_a_user_of_another_organization_is_404(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    stranger, _ = make_member(org_b, [])
    issued = phone_session(stranger, org_b)
    client = admin_client(api_client, org_a, make_member)

    response = client.post(revoke_url(stranger))

    assert response.status_code == 404
    issued.session.refresh_from_db()
    assert issued.session.revoked_at is None


def test_a_user_with_an_inactive_membership_can_still_be_revoked(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    courier, membership = make_member(org_a, [])
    issued = phone_session(courier, org_a)
    membership.is_active = False
    membership.save(update_fields=["is_active"])

    response = admin_client(api_client, org_a, make_member).post(revoke_url(courier))

    assert response.data == {"revoked_sessions": 1}
    issued.session.refresh_from_db()
    assert issued.session.revoked_at is not None


def test_revoking_a_user_without_sessions_answers_zero(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    courier, _ = make_member(org_a, [])

    response = admin_client(api_client, org_a, make_member).post(revoke_url(courier))

    assert response.data == {"revoked_sessions": 0}


@pytest.mark.parametrize("user_id", [str(uuid.uuid4()), "not-a-uuid"])
def test_an_unknown_user_is_404(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory, user_id: str
) -> None:
    client = admin_client(api_client, org_a, make_member)

    assert client.post(f"/api/v1/users/{user_id}/revoke-device-sessions/").status_code == 404


def test_session_revocation_permission_does_not_grant_personnel_reads(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    courier, _ = make_member(org_a, [])
    client = admin_client(api_client, org_a, make_member, "user.revoke_device_sessions")

    assert client.get("/api/v1/users/").status_code == 403
    assert client.get(f"/api/v1/users/{courier.pk}/").status_code == 403
    assert client.get(revoke_url(courier)).status_code == 405


def test_a_token_session_can_use_the_admin_endpoints_in_its_pinned_organization(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    admin, _ = make_member(org_a, ADMIN_AUTH_PERMISSION_CODES)
    DeviceFactory(organization=org_a)
    DeviceFactory(organization=org_b)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {phone_session(admin, org_a).access}")

    response = api_client.get(DEVICES)

    assert response.status_code == 200
    assert response.data["count"] == 2  # the admin's own phone and the other device of org A


# --- seed of admin permission codes (#3 seed tracking) ------------------------------------------


def seeded_organization(slug: str = "acme") -> Organization:
    organization, _ = bootstrap_organization(
        OrganizationSpec(name="Acme", slug=slug, country="MX", timezone="UTC"),
        AdminSpec(username=f"boss-{slug}", email=f"boss-{slug}@example.test"),
    )
    return organization


def test_a_new_organization_gives_the_admin_profile_the_device_codes() -> None:
    organization = seeded_organization()

    admin = Profile.objects.get(organization=organization, slug="admin")
    courier = Profile.objects.get(organization=organization, slug="courier")
    assert set(ADMIN_AUTH_PERMISSION_CODES) <= set(admin.permission_codes)
    assert set(ADMIN_AUTH_PERMISSION_CODES) <= set(admin.seeded_permission_codes)
    assert not set(ADMIN_AUTH_PERMISSION_CODES) & set(courier.permission_codes)


def test_the_device_codes_are_registered_in_the_default_admin_codes() -> None:
    assert set(ADMIN_AUTH_PERMISSION_CODES) <= set(DEFAULT_PROFILE_PERMISSIONS["admin"])
    assert not any(
        set(ADMIN_AUTH_PERMISSION_CODES) & set(codes)
        for slug, codes in DEFAULT_PROFILE_PERMISSIONS.items()
        if slug != "admin"
    )


def test_apply_grants_the_device_codes_to_an_organization_seeded_before_they_existed() -> None:
    organization = seeded_organization()
    admin = Profile.objects.get(organization=organization, slug="admin")
    Profile.objects.filter(pk=admin.pk).update(
        permission_codes=[
            c for c in admin.permission_codes if c not in ADMIN_AUTH_PERMISSION_CODES
        ],
        seeded_permission_codes=[
            c for c in admin.seeded_permission_codes if c not in ADMIN_AUTH_PERMISSION_CODES
        ],
    )

    call_command("seed_organization_defaults", organization=organization.slug, apply=True)

    admin.refresh_from_db()
    assert set(ADMIN_AUTH_PERMISSION_CODES) <= set(admin.permission_codes)


@pytest.mark.parametrize("code", ADMIN_AUTH_PERMISSION_CODES)
def test_a_device_code_an_admin_revoked_is_not_granted_again_by_apply(code: str) -> None:
    organization = seeded_organization()
    admin = Profile.objects.get(organization=organization, slug="admin")
    Profile.objects.filter(pk=admin.pk).update(
        permission_codes=[c for c in admin.permission_codes if c != code]
    )

    call_command("seed_organization_defaults", organization=organization.slug, apply=True)

    admin.refresh_from_db()
    assert code not in admin.permission_codes
    assert code in admin.seeded_permission_codes  # remembered as seeded: never re-granted


def test_the_old_backfill_command_is_gone() -> None:
    with pytest.raises(CommandError):
        call_command("grant_admin_permissions")


# --- final upload flag --------------------------------------------------------------------------


@pytest.mark.parametrize("flag", [True, False])
def test_revoking_user_sessions_leaves_a_final_upload_only_when_asked(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory, flag: bool
) -> None:
    courier, _ = make_member(org_a, [])
    issued = phone_session(courier, org_a)
    admin = admin_client(api_client, org_a, make_member)

    response = admin.post(revoke_url(courier), {"allow_final_upload": flag}, format="json")

    assert response.status_code == 200
    issued.session.refresh_from_db()
    assert (issued.session.final_upload_deadline is not None) is flag


@pytest.mark.parametrize("flag", [True, False])
def test_revoking_a_device_leaves_a_final_upload_only_when_asked(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory, flag: bool
) -> None:
    issued = phone_session(UserFactory(), org_a)
    admin = admin_client(api_client, org_a, make_member)

    response = admin.post(
        f"{DEVICES}{issued.session.device_id}/revoke/", {"allow_final_upload": flag}, format="json"
    )

    assert response.status_code == 200
    issued.session.refresh_from_db()
    assert (issued.session.final_upload_deadline is not None) is flag


def test_the_flag_must_be_a_boolean(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    courier, _ = make_member(org_a, [])
    admin = admin_client(api_client, org_a, make_member)

    response = admin.post(revoke_url(courier), {"allow_final_upload": "maybe"}, format="json")

    assert (response.status_code, response.data["code"]) == (400, "validation_error")
