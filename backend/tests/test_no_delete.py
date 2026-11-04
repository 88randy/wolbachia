"""Nothing is deleted: no DELETE routes, and models refuse physical deletion."""

import pytest
from django.urls import reverse
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APIClient

from core.exceptions import PhysicalDeleteForbiddenError
from organizations.models import Organization
from tests.factories import WidgetFactory
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db

API_PREFIX = "/api/v1/"


def test_schema_has_no_delete_operation_under_the_api_prefix() -> None:
    schema = SchemaGenerator().get_schema(request=None, public=True)

    delete_paths = [
        path
        for path, operations in schema["paths"].items()
        if path.startswith(API_PREFIX) and "delete" in operations
    ]

    assert schema["paths"], "the schema should not be empty"
    assert delete_paths == []


def test_delete_request_on_a_widget_is_method_not_allowed(
    client_a: APIClient, org_a: Organization
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.delete(f"{API_PREFIX}widgets/{widget.pk}/")

    assert response.status_code == 405
    assert response.data["code"] == "method_not_allowed"
    assert Widget.objects.filter(pk=widget.pk).exists()


def test_instance_delete_raises(org_a: Organization) -> None:
    widget = WidgetFactory(organization=org_a)

    with pytest.raises(PhysicalDeleteForbiddenError):
        widget.delete()


def test_queryset_delete_raises(org_a: Organization) -> None:
    WidgetFactory(organization=org_a)

    with pytest.raises(PhysicalDeleteForbiddenError):
        Widget.objects.all().delete()


def test_every_api_route_is_reachable_by_name() -> None:
    assert reverse("health") == "/api/v1/health/"
    assert reverse("me") == "/api/v1/me/"
