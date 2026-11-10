"""Minimal exact Wolbachia method proof; no procedure, threshold or authority is invented."""

from datetime import datetime
from typing import Any

from django.db.models import Prefetch

from field_sync.producers import ProducerContext
from lab.models import LabMethodVerification, LabMethodVersion


def capture_methods(ctx: ProducerContext) -> tuple[list[dict[str, Any]], list[datetime]]:
    versions = (
        LabMethodVersion.objects.filter(
            organization=ctx.organization, method__organization=ctx.organization
        )
        .prefetch_related(
            Prefetch(
                "verifications",
                queryset=LabMethodVerification.objects.filter(
                    organization=ctx.organization
                ).order_by("-revision"),
            )
        )
        .order_by("method_id", "-effective_from", "-revision")
    )
    boundaries: list[datetime] = []
    selected = set()
    methods = []
    for version in versions:
        future = [
            value for value in (version.created_at, version.effective_from) if value > ctx.now
        ]
        boundaries.extend(future)
        verifications = []
        for verification in version.verifications.all():
            if verification.created_at > ctx.now:
                boundaries.append(verification.created_at)
            else:
                verifications.append(verification)
        if future or version.method_id in selected:
            continue
        selected.add(version.method_id)
        verification = verifications[0] if verifications else None
        if (
            not version.supports_wolbachia
            or not version.procedure.strip()
            or not version.reference.strip()
            or verification is None
            or verification.decision != "verify"
            or verification.content_hash != version.content_hash
        ):
            continue
        methods.append(
            {
                "id": str(version.pk),
                "method_id": str(version.method_id),
                "label": version.name,
                "revision": version.revision,
                "created_at": version.created_at.isoformat(),
                "effective_from": version.effective_from.isoformat(),
                "content_hash": version.content_hash,
                "supports_wolbachia": version.supports_wolbachia,
                "verification": {
                    "id": str(verification.pk),
                    "revision": verification.revision,
                    "decision": verification.decision,
                    "content_hash": verification.content_hash,
                    "created_at": verification.created_at.isoformat(),
                },
            }
        )
    return methods, boundaries
