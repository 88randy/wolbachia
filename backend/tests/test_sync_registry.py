"""The event handler registry and the contract every registered handler must keep."""

import re
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from rest_framework import serializers

from field_sync import registry
from field_sync.codes import IN_REVIEW_CODES, REJECTED_CODES, REJECTION_QUOTA_EXCEEDED
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
    from field_sync.producers import BOOTSTRAP_SCHEMA_VERSION, get_producer

    assert find_handler("record.void", 1).on_void is None
    for event_type in ("supplies.receive", "supplies.reconcile"):
        handler = find_handler(event_type, 1)
        assert handler.checks_shift is True
        assert handler.on_void is not None
        assert handler.review_adapter is not None
    assert BOOTSTRAP_SCHEMA_VERSION == 2
    assert {
        key: get_producer(key).schema_version
        for key in (
            "history",
            "supplies",
            "assignments",
            "quadrants",
            "sampling_points",
            "ovitraps",
        )
    } == {
        "history": 5,
        "supplies": 1,
        "assignments": 3,
        "quadrants": 2,
        "sampling_points": 1,
        "ovitraps": 1,
    }


def test_every_registered_handler_keeps_the_registry_contract() -> None:
    assert HANDLERS, "the registry is empty"
    for (event_type, version), handler in HANDLERS.items():
        assert EVENT_TYPE.match(event_type), event_type
        assert (handler.event_type, handler.schema_version) == (event_type, version)
        assert version >= 1
        assert issubclass(handler.payload_serializer, serializers.Serializer), event_type
        assert callable(handler.apply), event_type
        assert handler.on_void is None or callable(handler.on_void), event_type


def camel(code: str) -> str:
    first, *rest = code.split("_")
    return first + "".join(part.capitalize() for part in rest)


def translated_and_documented(code: str, prefix: str) -> None:
    locales = REPO_ROOT / "packages" / "i18n" / "src" / "locales"
    key = f'"sync.{prefix}.{camel(code)}"'
    for language in ("es-MX", "en"):
        catalog = locales / language / "sync.ts"
        assert key in catalog.read_text(encoding="utf-8"), f"{key} missing in {catalog}"
    documentation = (REPO_ROOT / "docs" / "sync.md").read_text(encoding="utf-8")
    assert f"`{code}`" in documentation, f"{code} missing in docs/sync.md"


def test_builtin_result_codes_keep_their_translation_and_documentation_contract() -> None:
    for code in (*REJECTED_CODES, *IN_REVIEW_CODES):
        translated_and_documented(code, "result")
    for code in ("device_mismatch", "payload_too_large", "invalid_cursor", "sync_in_progress"):
        translated_and_documented(code, "batch")
    # Quota is a retry-only control code: its mobile handling/localization is outside #56's scope.
    documentation = (REPO_ROOT / "docs" / "sync.md").read_text(encoding="utf-8")
    assert f"`{REJECTION_QUOTA_EXCEEDED}`" in documentation


def test_every_code_an_epic_handler_declares_is_translated_and_documented() -> None:
    """The contract an epic signs when it registers: declare your codes, translate them, document
    them. Test-only handlers (tests/) are exempt."""
    declared = {
        code
        for handler in HANDLERS.values()
        if not handler.apply.__module__.startswith("tests.")
        for code in handler.codes
    }

    assert {"void_target_not_found", "void_target_not_owned", "already_voided"} <= declared
    for code in declared:
        translated_and_documented(code, "result")


def test_get_handler_returns_none_for_an_unregistered_pair() -> None:
    assert registry.get_handler("record.void", 1) is not None
    assert registry.get_handler("record.void", 2) is None
    assert registry.get_handler("nothing.here", 1) is None
