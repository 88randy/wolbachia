"""Bound self capture snapshot: stable semantics, real method/source facts and recovery."""

from dataclasses import replace
from typing import Any

from django.core.exceptions import ImproperlyConfigured

from core.snapshots import snapshot_hash
from field_sync.producers import ProducerContext
from lab.samples.capture_methods import capture_methods
from lab.samples.capture_serializers import SampleCaptureSnapshotSerializer
from lab.samples.capture_sources import CAPTURE_PERMISSIONS, capture_receipts, capture_sources


def capture_content(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    """An observation clock never churns conditional content or capture generations."""
    return (
        None
        if payload is None
        else {key: value for key, value in payload.items() if key != "as_of"}
    )


def _snapshot(ctx: ProducerContext) -> dict[str, Any] | None:
    if not all(ctx.scope.allows(permission) for permission in CAPTURE_PERMISSIONS):
        return None
    sources, boundaries = capture_sources(ctx)
    methods, method_boundaries = capture_methods(ctx) if sources else ([], [])
    boundaries.extend(method_boundaries)
    content = {
        "schema_version": 1,
        "organization_id": str(ctx.organization.pk),
        "user_id": str(ctx.user.pk),
        "valid_until": min(boundaries).isoformat() if boundaries else None,
        "methods": methods,
        "sources": sources,
        "receipts": capture_receipts(ctx, sources),
    }
    payload = {**content, "version": snapshot_hash(content), "as_of": ctx.now.isoformat()}
    serializer = SampleCaptureSnapshotSerializer(data=payload)
    if not serializer.is_valid():
        raise ImproperlyConfigured(f"Invalid sample capture snapshot: {serializer.errors}")
    return dict(serializer.data)


def _frame(ctx: ProducerContext, payload: dict[str, Any] | None) -> tuple[str, ...]:
    grants = [{"codes": sorted(codes), "scope": scope} for codes, scope in ctx.scope.grants]
    return (
        str(ctx.organization.pk),
        str(ctx.user.pk),
        snapshot_hash({"grants": grants, "generation": ctx.configuration_generation}),
        ctx.now.isoformat(),
        snapshot_hash({"payload": payload}),
        ctx.sample_visibility_revision,
    )


def prepare_sample_capture(ctx: ProducerContext) -> ProducerContext:
    payload = _snapshot(ctx)
    prepared = replace(
        ctx,
        sample_capture_payload=payload,
        sample_visibility_revision=snapshot_hash({"sample_capture": capture_content(payload)}),
    )
    return replace(prepared, sample_capture_frame=_frame(prepared, payload))


def bound_sample_capture(ctx: ProducerContext) -> ProducerContext:
    if ctx.sample_capture_frame is None:
        return prepare_sample_capture(ctx)
    if ctx.sample_capture_frame != _frame(ctx, ctx.sample_capture_payload):
        raise ImproperlyConfigured("Prepared sample capture context changed.")
    return ctx


def sample_capture_snapshot(ctx: ProducerContext) -> dict[str, Any] | None:
    return bound_sample_capture(ctx).sample_capture_payload
