"""An organization can never see or touch another organization's data (docs/api-conventions.md)."""

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization
from tests.factories import WidgetFactory
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/widgets/"


def detail_url(widget: Widget, suffix: str = "") -> str:
    return f"{LIST_URL}{widget.pk}/{suffix}"


def test_list_returns_only_widgets_of_the_active_organization(
    client_a: APIClient, org_a: Organization, org_b: Organization
) -> None:
    own = WidgetFactory(organization=org_a)
    WidgetFactory(organization=org_b)

    response = client_a.get(LIST_URL)

    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [str(own.pk)]


def test_retrieve_widget_of_another_organization_is_not_found(
    client_a: APIClient, org_b: Organization
) -> None:
    foreign = WidgetFactory(organization=org_b)

    response = client_a.get(detail_url(foreign))

    assert response.status_code == 404
    assert response.data["code"] == "not_found"


def test_patch_widget_of_another_organization_is_not_found_and_unchanged(
    client_a: APIClient, org_b: Organization
) -> None:
    foreign = WidgetFactory(organization=org_b, name="original")

    response = client_a.patch(detail_url(foreign), {"name": "hacked"}, format="json")

    foreign.refresh_from_db()
    assert response.status_code == 404
    assert foreign.name == "original"


def test_put_widget_of_another_organization_is_not_found(
    client_a: APIClient, org_b: Organization
) -> None:
    foreign = WidgetFactory(organization=org_b)

    response = client_a.put(detail_url(foreign), {"name": "x"}, format="json")

    assert response.status_code == 404


def test_void_widget_of_another_organization_is_not_found_and_not_voided(
    client_a: APIClient, org_b: Organization
) -> None:
    foreign = WidgetFactory(organization=org_b)

    response = client_a.post(detail_url(foreign, "void/"), {"reason": "x"}, format="json")

    foreign.refresh_from_db()
    assert response.status_code == 404
    assert foreign.voided_at is None


def test_create_ignores_organization_id_in_the_body(
    client_a: APIClient, org_a: Organization, org_b: Organization, member_a: User
) -> None:
    payload = {"name": "mine", "organization_id": str(org_b.pk), "organization": str(org_b.pk)}

    response = client_a.post(LIST_URL, payload, format="json")

    created = Widget.objects.get(pk=response.data["id"])
    assert response.status_code == 201
    assert created.organization == org_a
    assert created.created_by == member_a


def test_update_cannot_move_a_widget_to_another_organization(
    client_a: APIClient, org_a: Organization, org_b: Organization
) -> None:
    own = WidgetFactory(organization=org_a)

    client_a.patch(detail_url(own), {"name": "x", "organization": str(org_b.pk)}, format="json")

    own.refresh_from_db()
    assert own.organization == org_a


def test_organization_header_selects_the_active_organization(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member
) -> None:
    user, _ = make_member(org_a)
    make_member(org_b, user=user)
    WidgetFactory(organization=org_a)
    in_b = WidgetFactory(organization=org_b)
    api_client.force_authenticate(user)

    response = api_client.get(LIST_URL, headers={"X-Organization": "org-b"})

    assert [item["id"] for item in response.data["results"]] == [str(in_b.pk)]
