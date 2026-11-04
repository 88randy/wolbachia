"""Device registry and remote revoke (ADM): `/devices/` and `/users/{id}/revoke-device-sessions/`."""

import uuid

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.constants import ADMIN_AUTH_PERMISSION_CODES
from accounts.models import Device, RevokeReason, User
from accounts.services import DeviceInfo, start_device_session
from organizations.models import Organization, Profile
from organizations.services import (
    AdminSpec,
    OrganizationSpec,
    add_permission_codes_to_admin_profiles,
    bootstrap_organization,
)
from tests.conftest import MemberFactory
from tests.factories import DeviceFactory, MembershipFactory, OrganizationFactory, UserFactory

pytestmark = pytest.mark.django_db

DEVICES = "/api/v1/devices/"
ME = "/api/v1/me/"


def admin_client(
    api_client: APIClient, org: Organization, make_member: MemberFactory, *codes: str
) -> APIClient:
    user, _ = make_member(org, codes or ADMIN_AUTH_PERMISSION_CODES)
    api_client.force_authenticate(user)
    return api_client


def phone_session(user: User, org: Organization, device_id: uuid.UUID | None = None):
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
    assert phone.session.final_upload_deadline is not None
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
        assert issued.session.final_upload_deadline is not None
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


def test_the_users_endpoint_exposes_nothing_else(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    courier, _ = make_member(org_a, [])
    client = admin_client(api_client, org_a, make_member)

    assert client.get("/api/v1/users/").status_code == 404
    assert client.get(f"/api/v1/users/{courier.pk}/").status_code == 404
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


# --- seed of admin permission codes -------------------------------------------------------------


def test_bootstrap_gives_the_admin_profile_the_device_codes() -> None:
    organization, _ = bootstrap_organization(
        OrganizationSpec(name="Acme", slug="acme", country="MX", timezone="UTC"),
        AdminSpec(username="boss", email="boss@example.test"),
    )

    admin = Profile.objects.get(organization=organization, slug="admin")
    courier = Profile.objects.get(organization=organization, slug="courier")
    assert set(admin.permission_codes) == set(ADMIN_AUTH_PERMISSION_CODES)
    assert courier.permission_codes == []


def test_adding_admin_codes_is_idempotent_and_keeps_existing_codes() -> None:
    organization = OrganizationFactory()
    Profile.objects.create(
        organization=organization,
        slug="admin",
        label_es="A",
        label_en="A",
        permission_codes=["custom.code", "device.read"],
    )

    first = add_permission_codes_to_admin_profiles(organization=organization)
    second = add_permission_codes_to_admin_profiles(organization=organization)

    codes = Profile.objects.get(organization=organization, slug="admin").permission_codes
    assert (first, second) == (1, 0)
    assert codes == ["custom.code", "device.read", "device.revoke", "user.revoke_device_sessions"]


def test_adding_admin_codes_leaves_other_profiles_and_organizations_alone() -> None:
    target, other = OrganizationFactory(), OrganizationFactory()
    for organization in (target, other):
        Profile.objects.create(organization=organization, slug="admin", label_es="A", label_en="A")
    Profile.objects.create(organization=target, slug="courier", label_es="C", label_en="C")

    add_permission_codes_to_admin_profiles(organization=target)

    assert Profile.objects.get(organization=other, slug="admin").permission_codes == []
    assert Profile.objects.get(organization=target, slug="courier").permission_codes == []


def test_the_management_command_updates_existing_organizations(
    capsys: pytest.CaptureFixture[str],
) -> None:
    organization = OrganizationFactory()
    Profile.objects.create(organization=organization, slug="admin", label_es="A", label_en="A")

    call_command("grant_admin_permissions")
    call_command("grant_admin_permissions", organization=organization.slug)

    out = capsys.readouterr().out
    assert "Admin profiles updated: 1" in out
    assert "Admin profiles updated: 0" in out
    assert set(
        Profile.objects.get(organization=organization, slug="admin").permission_codes
    ) == set(ADMIN_AUTH_PERMISSION_CODES)


def test_the_management_command_rejects_an_unknown_organization() -> None:
    with pytest.raises(CommandError):
        call_command("grant_admin_permissions", organization="nope")
