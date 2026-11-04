"""Test-only event handlers: they write `Widget` rows so tests can see which writes survived."""

import threading
from typing import Any

from rest_framework import serializers

from core.fields import OrgScopedPrimaryKeyRelatedField
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext, EventHandler, register
from tests.testapp.models import Widget

LOCKED_TEXT = "locked"
# A handler that holds its batch open until the test lets go (real-concurrency tests).
SLOW_STARTED = threading.Event()
SLOW_RELEASE = threading.Event()
SLOW_TIMEOUT_SECONDS = 20


class NotePayload(serializers.Serializer[Any]):
    text = serializers.CharField(max_length=50)


class RelatedPayload(serializers.Serializer[Any]):
    widget = OrgScopedPrimaryKeyRelatedField(queryset=Widget.objects.all())


def write_widget(ctx: EventContext, name: str) -> Widget:
    return Widget.objects.create(organization=ctx.organization, name=name[:50])


def apply_note(ctx: EventContext, data: dict[str, Any]) -> None:
    write_widget(ctx, data["text"])


def apply_reject_after_write(ctx: EventContext, data: dict[str, Any]) -> None:
    write_widget(ctx, "written-before-rejection")
    raise EventRejected("test_rejection", {"text": data["text"]})


def apply_needs_review(ctx: EventContext, data: dict[str, Any]) -> None:
    write_widget(ctx, "written-before-review")
    raise EventNeedsReview("test_review", {"text": data["text"]})


def apply_context_probe(ctx: EventContext, data: dict[str, Any]) -> None:
    """Records what the pipeline told the handler about the event it is about to flag."""
    write_widget(ctx, f"review:{ctx.review_code}")


def apply_slow(ctx: EventContext, data: dict[str, Any]) -> None:
    SLOW_STARTED.set()
    SLOW_RELEASE.wait(SLOW_TIMEOUT_SECONDS)
    write_widget(ctx, "slow")


def apply_related(ctx: EventContext, data: dict[str, Any]) -> None:
    write_widget(ctx, f"related:{data['widget'].pk}")


def refuse_locked_void(ctx: EventContext, target: FieldEvent) -> None:
    if target.payload.get("text") == LOCKED_TEXT:
        raise EventRejected("test_void_refused")
    write_widget(ctx, "void-hook-ran")


def register_test_handlers() -> None:
    register(EventHandler("test.note", 1, NotePayload, apply_note))
    register(EventHandler("test.reject_after_write", 1, NotePayload, apply_reject_after_write))
    register(EventHandler("test.needs_review", 1, NotePayload, apply_needs_review))
    register(EventHandler("test.context_probe", 1, NotePayload, apply_context_probe))
    register(EventHandler("test.slow", 1, NotePayload, apply_slow))
    register(EventHandler("test.related", 1, RelatedPayload, apply_related))
    register(EventHandler("test.with_void_hook", 1, NotePayload, apply_note, refuse_locked_void))
