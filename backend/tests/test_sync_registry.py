"""The event handler registry and the contract every registered handler must keep."""

import re
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from rest_framework import serializers

from field_sync import registry
from field_sync.codes import IN_REVIEW_CODES, REJECTED_CODES, STATUS_BY_CODE
from field_sync.exceptions import EventRejected
from field_sync.registry import HANDLERS, EventContext, EventHandler, find_handler, register

REPO_ROOT = Path(settings.BASE_DIR).parent
EVENT_TYPE = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$")


class Payload(serializers.Serializer[Any]):
    text = serializers.CharField()


def do_nothing(ctx: EventContext, data: dict[str, Any]) -> None:
    return None


@pytest.fixture
def clean_registry(monkeypatch: pytest.MonkeyPatch) -> dict[tuple[str, int], EventHandler]:
    """The registry is process-wide: tests that register work on a copy."""
    copy = dict(HANDLERS)
    monkeypatch.setattr(registry, "HANDLERS", copy)
    return copy


def test_registering_the_same_type_and_version_twice_raises(
    clean_registry: dict[tuple[str, int], EventHandler],
) -> None:
    register(EventHandler("demo.thing", 1, Payload, do_nothing))

    with pytest.raises(ImproperlyConfigured, match="already registered"):
        register(EventHandler("demo.thing", 1, Payload, do_nothing))


def test_a_new_schema_version_of_a_type_can_be_registered(
    clean_registry: dict[tuple[str, int], EventHandler],
) -> None:
    register(EventHandler("demo.thing", 1, Payload, do_nothing))

    register(EventHandler("demo.thing", 2, Payload, do_nothing))

    assert find_handler("demo.thing", 2).schema_version == 2


def test_an_unknown_type_and_an_unknown_version_have_different_codes() -> None:
    with pytest.raises(EventRejected) as unknown_type:
        find_handler("nothing.here", 1)
    with pytest.raises(EventRejected) as unknown_version:
        find_handler("test.note", 99)

    assert unknown_type.value.code == "unsupported_event_type"
    assert unknown_version.value.code == "unsupported_schema_version"
    assert unknown_version.value.params == {"type": "test.note", "schema_version": 99}


def test_record_void_is_registered_by_the_app_itself() -> None:
    assert find_handler("record.void", 1).on_void is None


def test_every_registered_handler_keeps_the_registry_contract() -> None:
    assert HANDLERS, "the registry is empty"
    for (event_type, version), handler in HANDLERS.items():
        assert EVENT_TYPE.match(event_type), event_type
        assert (handler.event_type, handler.schema_version) == (event_type, version)
        assert version >= 1
        assert issubclass(handler.payload_serializer, serializers.Serializer), event_type
        assert callable(handler.apply), event_type
        assert handler.on_void is None or callable(handler.on_void), event_type


def test_result_codes_have_one_status_each_and_no_overlap() -> None:
    assert set(REJECTED_CODES).isdisjoint(IN_REVIEW_CODES)
    assert set(STATUS_BY_CODE) == {*REJECTED_CODES, *IN_REVIEW_CODES}


def camel(code: str) -> str:
    first, *rest = code.split("_")
    return first + "".join(part.capitalize() for part in rest)


def test_every_result_code_is_translated_in_both_languages_and_documented() -> None:
    locales = REPO_ROOT / "packages" / "i18n" / "src" / "locales"
    spanish = (locales / "es-MX.ts").read_text(encoding="utf-8")
    english = (locales / "en.ts").read_text(encoding="utf-8")
    documentation = (REPO_ROOT / "docs" / "sync.md").read_text(encoding="utf-8")

    for code in (*REJECTED_CODES, *IN_REVIEW_CODES):
        key = f'"sync.result.{camel(code)}"'
        assert key in spanish, f"{key} missing in es-MX"
        assert key in english, f"{key} missing in en"
        assert f"`{code}`" in documentation, f"{code} missing in docs/sync.md"
    for code in ("device_mismatch", "payload_too_large", "invalid_cursor"):
        assert f'"sync.batch.{camel(code)}"' in spanish
        assert f'"sync.batch.{camel(code)}"' in english
        assert f"`{code}`" in documentation
