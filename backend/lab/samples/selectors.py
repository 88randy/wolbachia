"""Read the minimal sample identity with one binding across actual source contexts."""

from typing import Any
from uuid import UUID

from django.db.models import Q, QuerySet
from django.http import Http404

from inventory.transfers.scope import paired_query
from lab.samples.models import WolbachiaSample
from uploads.access import UploadActor, current_scope


def sample_pair_query(grant: Any, prefix: str = "") -> Q:  # noqa: ANN401 -- canonical paired WorkScope
    return (
        paired_query(grant, prefix + "location__center_id", prefix + "location__quadrant_id")
        & (
            Q(**{prefix + "reading__isnull": True})
            | paired_query(
                grant,
                prefix + "reading__ovitrap__sampling_point__block__quadrant__center_id",
                prefix + "reading__ovitrap__sampling_point__block__quadrant_id",
            )
        )
        & (
            Q(**{prefix + "lot__isnull": True})
            | paired_query(grant, prefix + "lot__center_id", prefix + "lot__quadrant_id")
        )
    )


def sample_rows(actor: UploadActor, permission: str) -> QuerySet[WolbachiaSample]:
    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if permission in codes:
            allowed |= sample_pair_query(grant)
    return (
        WolbachiaSample.objects.filter(organization=actor.organization)
        .filter(allowed)
        .select_related(
            "event",
            "origin",
            "method_version",
            "location",
            "lot",
            "reading__event",
            "reading__ovitrap__sampling_point__block__quadrant",
        )
    )


def sample_contexts(sample: WolbachiaSample) -> list[dict[str, str | None]]:
    location = sample.location
    quadrant_id: UUID | None
    if sample.reading is not None:
        quadrant = sample.reading.ovitrap.sampling_point.block.quadrant
        center_id, quadrant_id = quadrant.center_id, quadrant.pk
    else:
        if sample.lot is None:
            raise Http404
        center_id, quadrant_id = sample.lot.center_id, sample.lot.quadrant_id
    return [
        {
            "center_id": str(location.center_id),
            "quadrant_id": str(location.quadrant_id) if location.quadrant_id else None,
        },
        {"center_id": str(center_id), "quadrant_id": str(quadrant_id) if quadrant_id else None},
    ]
