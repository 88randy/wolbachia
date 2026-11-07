"""Validated point append under B33 locks, without acquiring foreign action grants."""

from datetime import datetime
from typing import Any

from geography.decisions.exceptions import GeographyDecisionConflictError
from geography.models import PointVersion
from geography.services import _check_point_location, _location, spacing_warnings
from ovitraps.lifecycle.models import RelocationProposal
from uploads.access import UploadActor


def append_relocation_point_version(
    proposal: RelocationProposal, actor: UploadActor, instant: datetime
) -> tuple[PointVersion, list[dict[str, Any]]]:
    point = proposal.ovitrap.sampling_point
    previous = point.versions.order_by("-version").first()
    if previous is None or previous.pk != proposal.point_version_id or previous.is_retired:
        raise GeographyDecisionConflictError(
            [
                {
                    "reason": "relocation_revision_conflict",
                    "permission": "relocation.decide",
                    "link": "",
                }
            ]
        )
    location = _location(proposal.new_location)
    _check_point_location(point.block, location)
    _check_point_location(point.block, location, instant)
    warnings = spacing_warnings(point.block, location, point.pk)
    version = PointVersion.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        point=point,
        location=location,
        version=previous.version + 1,
        effective_from=instant,
    )
    return version, warnings
