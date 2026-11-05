"""Updates never touch void fields and never succeed on voided records."""

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from core.services import void_record
from organizations.models import Organization
from tests.factories import OrganizationFactory, WidgetFactory
from tests.testapp.models import Widget
from tests.testapp.views import WidgetViewSet

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("void_catalog")]

WIDGETS = "/api/v1/widgets/"


def test_patch_on_a_voided_widget_is_409_already_voided(
    client_a: APIClient, org_a: Organization, member_a: User
) -> None:
    widget = WidgetFactory(organization=org_a, name="before")
    void_record(widget, member_a, "a clear mistake", "other")

    response = client_a.patch(f"{WIDGETS}{widget.pk}/", {"name": "after"}, format="json")

    widget.refresh_from_db()
    assert response.status_code == 409
    assert response.data["code"] == "already_voided"
    assert widget.name == "before"


def test_put_on_a_voided_widget_is_409_already_voided(
    client_a: APIClient, org_a: Organization, member_a: User
) -> None:
    widget = WidgetFactory(organization=org_a)
    void_record(widget, member_a, "a clear mistake", "other")

    response = client_a.put(f"{WIDGETS}{widget.pk}/", {"name": "after"}, format="json")

    assert response.status_code == 409


def test_void_committed_between_read_and_save_survives_the_patch(
    client_a: APIClient,
    org_a: Organization,
    member_a: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PATCH reads the record, a void commits, then the PATCH saves: the void must win."""
    widget = WidgetFactory(organization=org_a, name="before")
    real_perform_update = WidgetViewSet.perform_update

    def void_then_update(self, serializer) -> None:
        # The record was already read by the PATCH; another request voids it before the save.
        void_record(Widget.objects.get(pk=widget.pk), member_a, "concurrent void", "other")
        real_perform_update(self, serializer)

    monkeypatch.setattr(WidgetViewSet, "perform_update", void_then_update)

    response = client_a.patch(f"{WIDGETS}{widget.pk}/", {"name": "after"}, format="json")

    widget.refresh_from_db()
    assert response.status_code == 409
    assert response.data["code"] == "already_voided"
    assert widget.voided_at is not None
    assert widget.voided_by == member_a
    assert widget.void_reason == "concurrent void"
    assert widget.name == "before"


def test_patch_on_a_live_widget_keeps_void_fields_empty(
    client_a: APIClient, org_a: Organization
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.patch(
        f"{WIDGETS}{widget.pk}/",
        {
            "name": "after",
            "void_reason": "sneaky",
            "void_reason_code": "duplicate-record",
            "voided_at": "2026-01-01T00:00:00Z",
        },
        format="json",
    )

    widget.refresh_from_db()
    assert response.status_code == 200
    assert widget.name == "after"
    assert widget.voided_at is None
    assert (widget.void_reason, widget.void_reason_code) == ("", "")


def test_related_widget_of_another_organization_is_rejected_like_a_missing_one(
    client_a: APIClient,
) -> None:
    foreign = WidgetFactory(organization=OrganizationFactory(slug="org-z"))
    missing = "00000000-0000-0000-0000-000000000000"

    foreign_response = client_a.post(
        WIDGETS, {"name": "x", "related": str(foreign.pk)}, format="json"
    )
    missing_response = client_a.post(WIDGETS, {"name": "x", "related": missing}, format="json")

    assert foreign_response.status_code == 400
    assert foreign_response.data["fields"] == missing_response.data["fields"]
    assert foreign_response.data["fields"]["related"][0]["code"] == "does_not_exist"


def test_related_widget_of_the_same_organization_is_accepted(
    client_a: APIClient, org_a: Organization
) -> None:
    own = WidgetFactory(organization=org_a)

    response = client_a.post(WIDGETS, {"name": "x", "related": str(own.pk)}, format="json")

    assert response.status_code == 201
    assert response.data["related"] == own.pk
