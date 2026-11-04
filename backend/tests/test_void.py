import pytest
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from accounts.models import User
from core.exceptions import AlreadyVoidedError
from core.services import void_record
from organizations.models import Organization
from tests.factories import UserFactory, WidgetFactory
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db

WIDGETS = "/api/v1/widgets/"


def test_void_endpoint_records_who_when_and_why(
    client_a: APIClient, org_a: Organization, member_a: User
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {"reason": "duplicate"}, format="json")

    widget.refresh_from_db()
    assert response.status_code == 200
    assert widget.voided_by == member_a
    assert widget.void_reason == "duplicate"
    assert widget.voided_at is not None
    assert response.data["void_reason"] == "duplicate"


def test_void_without_reason_is_a_validation_error(
    client_a: APIClient, org_a: Organization
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {"reason": "  "}, format="json")

    assert response.status_code == 400
    assert response.data["fields"]["reason"][0]["code"] == "blank"


def test_voiding_twice_returns_409_already_voided(client_a: APIClient, org_a: Organization) -> None:
    widget = WidgetFactory(organization=org_a)
    client_a.post(f"{WIDGETS}{widget.pk}/void/", {"reason": "first"}, format="json")

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {"reason": "second"}, format="json")

    widget.refresh_from_db()
    assert response.status_code == 409
    assert response.data["code"] == "already_voided"
    assert widget.void_reason == "first"


def test_list_excludes_voided_unless_include_voided_is_true(
    client_a: APIClient, org_a: Organization, member_a: User
) -> None:
    kept = WidgetFactory(organization=org_a)
    voided = WidgetFactory(organization=org_a)
    void_record(voided, member_a, "mistake")

    default = client_a.get(WIDGETS)
    everything = client_a.get(WIDGETS, {"include_voided": "true"})

    assert [w["id"] for w in default.data["results"]] == [str(kept.pk)]
    assert {w["id"] for w in everything.data["results"]} == {str(kept.pk), str(voided.pk)}


def test_a_voided_widget_can_still_be_retrieved_by_id(
    client_a: APIClient, org_a: Organization, member_a: User
) -> None:
    widget = WidgetFactory(organization=org_a)
    void_record(widget, member_a, "mistake")

    response = client_a.get(f"{WIDGETS}{widget.pk}/")

    assert response.status_code == 200


def test_void_record_raises_already_voided_on_second_call(org_a: Organization) -> None:
    user = UserFactory()
    widget = WidgetFactory(organization=org_a)
    void_record(widget, user, "first")

    with pytest.raises(AlreadyVoidedError):
        void_record(widget, user, "second")


def test_database_rejects_a_voided_row_without_reason(org_a: Organization) -> None:
    user = UserFactory()
    widget = WidgetFactory(organization=org_a)

    with pytest.raises(IntegrityError), transaction.atomic():
        Widget.objects.filter(pk=widget.pk).update(voided_at="2026-01-01T00:00:00Z", voided_by=user)


def test_database_rejects_a_reason_without_voided_at(org_a: Organization) -> None:
    widget = WidgetFactory(organization=org_a)

    with pytest.raises(IntegrityError), transaction.atomic():
        Widget.objects.filter(pk=widget.pk).update(void_reason="orphan reason")


def test_voidable_queryset_filters_voided_and_not_voided(
    org_a: Organization, member_a: User
) -> None:
    kept = WidgetFactory(organization=org_a)
    voided = WidgetFactory(organization=org_a)
    void_record(voided, member_a, "mistake")

    assert list(Widget.objects.not_voided()) == [kept]
    assert list(Widget.objects.voided()) == [voided]


def test_void_reason_longer_than_1000_characters_is_a_validation_error(
    client_a: APIClient, org_a: Organization
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {"reason": "x" * 1001}, format="json")

    assert response.status_code == 400
    assert response.data["fields"]["reason"][0]["code"] == "max_length"


def test_session_post_without_csrf_token_is_forbidden(member_a: User) -> None:
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(member_a)

    response = client.post(WIDGETS, {"name": "x"}, format="json")

    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"
    assert not Widget.objects.exists()
