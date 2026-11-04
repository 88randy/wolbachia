"""Permission codes are checked per action and fail closed."""

import pytest
from rest_framework.test import APIClient

from organizations.models import Organization
from tests.conftest import WIDGET_CODES, MemberFactory
from tests.factories import ProfileFactory, WidgetFactory

pytestmark = pytest.mark.django_db

WIDGETS = "/api/v1/widgets/"


def client_with(
    api_client: APIClient, make_member: MemberFactory, org: Organization, *codes: str
) -> APIClient:
    user, _ = make_member(org, codes)
    api_client.force_authenticate(user)
    return api_client


def test_viewset_without_declared_permissions_denies_everything(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    client = client_with(api_client, make_member, org_a, "widget.read", "widget.create")

    assert client.get("/api/v1/undeclared-widgets/").status_code == 403
    assert (
        client.post("/api/v1/undeclared-widgets/", {"name": "x"}, format="json").status_code == 403
    )


@pytest.mark.parametrize("action", ["list", "retrieve"])
def test_read_code_allows_list_and_retrieve_only(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory, action: str
) -> None:
    widget = WidgetFactory(organization=org_a)
    client = client_with(api_client, make_member, org_a, "widget.read")
    url = WIDGETS if action == "list" else f"{WIDGETS}{widget.pk}/"

    assert client.get(url).status_code == 200


@pytest.mark.parametrize(
    ("method", "suffix", "payload"),
    [
        ("post", "", {"name": "x"}),
        ("patch", "{pk}/", {"name": "x"}),
        ("put", "{pk}/", {"name": "x"}),
        ("post", "{pk}/void/", {"reason": "a valid reason"}),
    ],
    ids=["create", "patch", "put", "void"],
)
def test_read_code_does_not_allow_writes_or_void(
    api_client: APIClient,
    org_a: Organization,
    make_member: MemberFactory,
    method: str,
    suffix: str,
    payload: dict[str, str],
) -> None:
    widget = WidgetFactory(organization=org_a)
    client = client_with(api_client, make_member, org_a, "widget.read")

    response = getattr(client, method)(
        WIDGETS + suffix.format(pk=widget.pk), payload, format="json"
    )

    assert response.status_code == 403


def test_options_is_denied_because_metadata_has_no_permission_code(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    client = client_with(api_client, make_member, org_a, *WIDGET_CODES)

    assert client.options(WIDGETS).status_code == 403


def test_create_code_allows_only_create(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    client = client_with(api_client, make_member, org_a, "widget.create")

    assert client.post(WIDGETS, {"name": "x"}, format="json").status_code == 201
    assert client.get(WIDGETS).status_code == 403


def test_update_code_allows_patch_and_put_only(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    widget = WidgetFactory(organization=org_a)
    client = client_with(api_client, make_member, org_a, "widget.update")
    detail = f"{WIDGETS}{widget.pk}/"

    assert client.patch(detail, {"name": "x"}, format="json").status_code == 200
    assert client.put(detail, {"name": "y"}, format="json").status_code == 200
    assert client.get(detail).status_code == 403


def test_void_code_allows_void_only(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    widget = WidgetFactory(organization=org_a)
    client = client_with(api_client, make_member, org_a, "widget.void")
    detail = f"{WIDGETS}{widget.pk}/"

    assert (
        client.post(f"{detail}void/", {"reason": "a valid reason"}, format="json").status_code
        == 200
    )
    assert client.patch(detail, {"name": "x"}, format="json").status_code == 403


def test_codes_of_a_profile_from_another_organization_grant_nothing(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    user, membership = make_member(org_a)
    membership.profiles.add(ProfileFactory(organization=org_b, permission_codes=["widget.read"]))
    api_client.force_authenticate(user)

    assert api_client.get(WIDGETS).status_code == 403
