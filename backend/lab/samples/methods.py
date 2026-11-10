"""Explicit named Wolbachia capability; no inferred assay procedure or threshold."""

from datetime import datetime
from uuid import UUID

from django.http import Http404

from lab.exceptions import LabConflictError
from lab.models import LabMethodVerification, LabMethodVersion
from organizations.models import Organization


def wolbachia_method(
    organization: Organization, identifier: UUID, at: datetime
) -> tuple[LabMethodVersion, LabMethodVerification]:
    """Only facts actually recorded by the observation instant can prove its method."""
    version = LabMethodVersion.objects.filter(
        organization=organization, pk=identifier, method__organization=organization
    ).first()
    if version is None:
        raise Http404
    if version.created_at > at or version.effective_from > at or not version.supports_wolbachia:
        raise LabConflictError("sample_configuration_unavailable")
    current = (
        LabMethodVersion.objects.filter(
            organization=organization,
            method_id=version.method_id,
            effective_from__lte=at,
            created_at__lte=at,
        )
        .order_by("-effective_from", "-revision")
        .first()
    )
    verification = version.verifications.filter(created_at__lte=at).order_by("-revision").first()
    if (
        current is None
        or current.pk != version.pk
        or not version.procedure.strip()
        or not version.reference.strip()
        or verification is None
        or verification.decision != "verify"
        or verification.content_hash != version.content_hash
    ):
        raise LabConflictError("sample_configuration_unavailable")
    return version, verification
