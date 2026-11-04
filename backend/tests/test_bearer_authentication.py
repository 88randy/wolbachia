"""Mobile requests: `Authorization: Bearer <access>` bound to a device session."""

import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APIClient

from accounts.models import Device, DeviceSession, RevokeReason, TokenPair
from accounts.revocation import Revocation, revoke_session
from accounts.services import DeviceInfo, start_device_session
from accounts.token_pairs import rotate_refresh_token
from organizations.models import Organization
from tests.conftest import WIDGET_CODES, MemberFactory
from tests.factories import MembershipFactory, OrganizationFactory, WidgetFactory

pytestmark = pytest.mark.django_db

ME = "/api/v1/me/"
WIDGETS = "/api/v1/widgets/"


def issue(user, organization):
    return start_device_session(user, organization, DeviceInfo(device_id=uuid.uuid4()))


def authorize(client: APIClient, token: str) -> APIClient:
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def test_valid_token_authenticates_the_request(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a, ["ovitrap.read"])
    issued = issue(user, org_a)

    response = authorize(api_client, issued.access).get(ME)

    assert response.status_code == 200
    assert response.data["user"]["username"] == user.username
    assert response.data["permissions"] == ["ovitrap.read"]


def test_token_requests_enforce_permission_codes(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    allowed, _ = make_member(org_a, WIDGET_CODES)
    denied, _ = make_member(org_a, [])

    assert authorize(api_client, issue(allowed, org_a).access).get(WIDGETS).status_code == 200
    assert authorize(api_client, issue(denied, org_a).access).get(WIDGETS).status_code == 403


@pytest.mark.parametrize("header", ["Bearer", "Bearer a b", "Bearer \xe9"])
def test_malformed_bearer_header_is_an_invalid_token(api_client: APIClient, header: str) -> None:
    api_client.credentials(HTTP_AUTHORIZATION=header)

    response = api_client.get(ME)

    assert response.status_code == 401
    assert response.data["code"] == "invalid_token"


def test_unknown_token_is_401_invalid_token_with_a_challenge(api_client: APIClient) -> None:
    response = authorize(api_client, "never-issued").get(ME)

    assert response.status_code == 401
    assert response.data["code"] == "invalid_token"
    assert "WWW-Authenticate" in response.headers


def test_other_schemes_and_missing_header_stay_unauthenticated(api_client: APIClient) -> None:
    assert api_client.get(ME).data["code"] == "not_authenticated"
    api_client.credentials(HTTP_AUTHORIZATION="Basic Zm9vOmJhcg==")
    assert api_client.get(ME).data["code"] == "not_authenticated"


def test_the_token_is_not_accepted_as_a_digest(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)

    response = authorize(api_client, issued.pair.access_hash).get(ME)

    assert response.status_code == 401


def test_expired_access_token_is_401_token_expired(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)
    TokenPair.objects.filter(pk=issued.pair.pk).update(
        access_expires_at=timezone.now() - timedelta(seconds=1)
    )

    response = authorize(api_client, issued.access).get(ME)

    assert (response.status_code, response.data["code"]) == (401, "token_expired")


def test_revoked_session_is_401_session_revoked_on_the_next_request(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)
    authorize(api_client, issued.access)
    assert api_client.get(ME).status_code == 200

    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE))

    response = api_client.get(ME)
    assert (response.status_code, response.data["code"]) == (401, "session_revoked")


def test_session_of_a_revoked_device_is_refused_even_if_not_marked(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)
    Device.objects.filter(pk=issued.session.device_id).update(
        is_revoked=True, revoked_at=timezone.now()
    )

    response = authorize(api_client, issued.access).get(ME)

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")


def test_deactivated_user_is_refused_without_writing_a_revocation(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)
    user.is_active = False
    user.save(update_fields=["is_active"])

    response = authorize(api_client, issued.access).get(ME)

    issued.session.refresh_from_db()
    assert (response.status_code, response.data["code"]) == (401, "session_revoked")
    # Authentication only rejects: the revocation happens on refresh and on deactivation, so
    # nothing here can be rolled back by an enclosing transaction.
    assert issued.session.revoked_at is None


def test_token_pins_the_organization_even_for_multi_organization_users(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a, WIDGET_CODES)
    MembershipFactory(user=user, organization=org_b)
    issued = issue(user, org_a)

    response = authorize(api_client, issued.access).get(ME)

    assert response.data["organization"]["slug"] == "org-a"
    assert authorize(api_client, issued.access).get(WIDGETS).status_code == 200


def test_header_naming_the_same_organization_is_accepted(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)

    response = authorize(api_client, issued.access).get(ME, headers={"X-Organization": "org-a"})

    assert response.status_code == 200


def test_header_naming_another_organization_is_403_even_if_the_user_belongs_to_it(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a, WIDGET_CODES)
    MembershipFactory(user=user, organization=org_b)
    authorize(api_client, issue(user, org_a).access)

    for url in (ME, WIDGETS):
        response = api_client.get(url, headers={"X-Organization": "org-b"})
        assert (response.status_code, response.data["code"]) == (403, "no_active_membership")


def test_membership_is_revalidated_on_every_request(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, membership = make_member(org_a, WIDGET_CODES)
    authorize(api_client, issue(user, org_a).access)
    assert api_client.get(WIDGETS).status_code == 200

    membership.is_active = False
    membership.save(update_fields=["is_active"])

    response = api_client.get(WIDGETS)
    assert (response.status_code, response.data["code"]) == (403, "no_active_membership")


def test_a_token_never_reads_another_organizations_objects(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    other = OrganizationFactory(slug="org-z")
    foreign = WidgetFactory(organization=other)
    user, _ = make_member(org_a, WIDGET_CODES)
    authorize(api_client, issue(user, org_a).access)

    response = api_client.get(f"{WIDGETS}{foreign.pk}/")

    assert response.status_code == 404


def test_a_request_after_a_quiet_minute_records_the_activity(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)
    stale = timezone.now() - timedelta(minutes=5)
    DeviceSession.objects.filter(pk=issued.session.pk).update(last_used_at=stale)
    Device.objects.filter(pk=issued.session.device_id).update(last_seen_at=stale)

    authorize(api_client, issued.access).get(ME)

    session = DeviceSession.objects.get(pk=issued.session.pk)
    assert session.last_used_at > stale
    assert Device.objects.get(pk=session.device_id).last_seen_at > stale


def test_activity_is_not_rewritten_within_a_minute(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)
    authorize(api_client, issued.access).get(ME)
    recorded = DeviceSession.objects.get(pk=issued.session.pk).last_used_at

    api_client.get(ME)

    assert DeviceSession.objects.get(pk=issued.session.pk).last_used_at == recorded


def test_the_first_use_of_an_access_token_is_recorded_once(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)
    assert TokenPair.objects.get(pk=issued.pair.pk).access_used_at is None

    authorize(api_client, issued.access).get(ME)
    first_use = TokenPair.objects.get(pk=issued.pair.pk).access_used_at
    api_client.get(ME)

    assert first_use is not None
    assert TokenPair.objects.get(pk=issued.pair.pk).access_used_at == first_use


def test_the_replaced_access_token_works_inside_the_grace_window_and_not_after(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    issued = issue(user, org_a)
    rotate_refresh_token(issued.refresh, issued.session.device_id)

    inside = authorize(api_client, issued.access).get(ME)
    moment = timezone.now() - timedelta(seconds=120)
    TokenPair.objects.filter(pk=issued.pair.pk).update(consumed_at=moment, superseded_at=moment)
    after = api_client.get(ME)

    assert inside.status_code == 200
    assert (after.status_code, after.data["code"]) == (401, "invalid_token")


def test_bearer_401_answers_carry_the_bearer_challenge(api_client: APIClient) -> None:
    response = authorize(api_client, "never-issued").get(ME)

    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_a_missing_token_keeps_the_session_challenge(api_client: APIClient) -> None:
    assert api_client.get(ME).headers["WWW-Authenticate"] == "Session"


def test_the_schema_documents_bearer_authentication() -> None:
    schema = SchemaGenerator().get_schema(request=None, public=True)

    assert schema["components"]["securitySchemes"]["bearerAuth"] == {
        "type": "http",
        "scheme": "bearer",
        "description": "Opaque access token.",
    }
    assert {"bearerAuth": []} in schema["paths"]["/api/v1/me/"]["get"]["security"]


def test_the_schema_has_one_bearer_scheme_including_logout() -> None:
    schema = SchemaGenerator().get_schema(request=None, public=True)

    schemes = schema["components"]["securitySchemes"]
    assert [name for name in schemes if "earer" in name] == ["bearerAuth"]
    assert {"bearerAuth": []} in schema["paths"]["/api/v1/auth/logout/"]["post"]["security"]
