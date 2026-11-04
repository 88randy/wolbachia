"""Structural guards: rules that must hold for every current and future viewset or field."""

import re
from collections.abc import Iterator
from typing import Any

import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.urls import URLPattern, URLResolver, get_resolver

from accounts.models import User
from core.fields import OrgScopedPrimaryKeyRelatedField
from core.permissions import HasPermissionCode
from core.serializers import OrgScopedModelSerializer
from core.views import OrgScopedViewSetMixin
from tests.testapp.views import WidgetSerializer

BACKEND_DIR = settings.BASE_DIR


def iter_callbacks(patterns: list[Any]) -> Iterator[Any]:
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from iter_callbacks(pattern.url_patterns)
        elif isinstance(pattern, URLPattern):
            yield pattern.callback


def org_scoped_viewsets() -> list[Any]:
    callbacks = iter_callbacks(get_resolver(settings.ROOT_URLCONF).url_patterns)
    return [
        callback
        for callback in callbacks
        if hasattr(callback, "cls") and issubclass(callback.cls, OrgScopedViewSetMixin)
    ]


def effective_permission_classes(callback: Any, action_method: Any) -> list[Any]:  # noqa: ANN401
    """Class-level classes, then the `as_view` kwargs, then the `@action(...)` override."""
    classes = callback.cls.permission_classes
    classes = callback.initkwargs.get("permission_classes", classes)
    return getattr(action_method, "kwargs", {}).get("permission_classes", classes)


def test_the_urlconf_registers_org_scoped_viewsets() -> None:
    assert len(org_scoped_viewsets()) >= 4


def test_every_org_scoped_viewset_and_action_keeps_has_permission_code() -> None:
    offenders = []
    for callback in org_scoped_viewsets():
        for action_name in callback.actions.values():
            method = getattr(callback.cls, action_name)
            if HasPermissionCode not in effective_permission_classes(callback, method):
                offenders.append(f"{callback.cls.__name__}.{action_name}")

    assert offenders == []


def test_business_serializers_extend_the_org_scoped_base() -> None:
    assert issubclass(WidgetSerializer, OrgScopedModelSerializer)


def test_org_scoped_serializer_builds_org_scoped_relation_fields() -> None:
    field = WidgetSerializer().fields["related"]

    assert isinstance(field, OrgScopedPrimaryKeyRelatedField)


def test_org_scoped_field_on_a_model_without_organization_fails_at_configuration_time() -> None:
    with pytest.raises(ImproperlyConfigured, match="no `organization` field"):
        OrgScopedPrimaryKeyRelatedField(queryset=User.objects.all())


def test_env_example_does_not_offer_the_settings_module_selector() -> None:
    """DJANGO_SETTINGS_MODULE is picked before backend/.env is read, so the file cannot set it."""
    lines = (BACKEND_DIR / ".env.example").read_text(encoding="utf-8").splitlines()

    active = [line for line in lines if line.strip().startswith("DJANGO_SETTINGS_MODULE")]
    commented = [line for line in lines if line.lstrip("# ").startswith("DJANGO_SETTINGS_MODULE=")]
    assert active == []
    assert commented == []


# The constant, a raw META key, or a literal header lookup: any way to read the header.
ORGANIZATION_HEADER_ACCESS = re.compile(
    r"ORGANIZATION_HEADER|HTTP_X_ORGANIZATION|(?:headers|META)[\[.](?:get\()?[\"']X-Organization",
)
ORGANIZATION_HEADER_READERS = {
    "accounts/request_context.py",  # the only place that parses the header
    "core/constants.py",  # defines the name
    "core/schema.py",  # documents it in OpenAPI
}


def test_the_organization_header_is_read_in_one_place_only() -> None:
    """A second reader could skip the token's pinned organization (`requested_organization_slug`)."""
    offenders = []
    for path in BACKEND_DIR.rglob("*.py"):
        relative = path.relative_to(BACKEND_DIR).as_posix()
        if relative.startswith(("tests/", ".venv/")) or "/migrations/" in relative:
            continue
        text = path.read_text(encoding="utf-8")
        if ORGANIZATION_HEADER_ACCESS.search(text) and relative not in ORGANIZATION_HEADER_READERS:
            offenders.append(relative)

    assert offenders == []
