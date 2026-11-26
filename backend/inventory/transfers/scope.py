"""One contributing action binding must cover the COMPLETE real transfer vector."""

from collections.abc import Iterable, Mapping
from typing import Any

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from organizations.scope import EffectiveScope, contains
from uploads.access import UploadActor, current_scope

StorageContext = Mapping[str, str | None]


def allows_transfer_vector(
    scope: EffectiveScope, permission: str, contexts: Iterable[StorageContext]
) -> bool:
    """Never combine different bindings across endpoints or treat unknown storage as org-only."""
    vector = tuple(contexts)
    if not vector or any(not pair.get("center_id") for pair in vector):
        return False
    return any(
        permission in codes
        and all(
            contains(grant["centers"], pair["center_id"])
            and contains(grant["quadrants"], pair["quadrant_id"])
            for pair in vector
        )
        for codes, grant in scope.grants
    )


def transfer_contexts(transfer: Any) -> tuple[dict[str, str | None], ...]:  # noqa: ANN401 -- immutable registered transfer
    locations = [transfer.origin, transfer.destination]
    for line in transfer.lines.select_related(
        "origin_version__location", "destination_version__location"
    ):
        locations.extend((line.origin_version.location, line.destination_version.location))
    return tuple(
        {
            "center_id": str(location.center_id),
            "quadrant_id": str(location.quadrant_id) if location.quadrant_id else None,
        }
        for location in locations
    )


def require_transfer_scope(authority: Any, permission: str, transfer: Any) -> None:  # noqa: ANN401 -- named command authority and concrete transfer
    source = authority.source
    capability = (
        None
        if source is None or source.review_context is None
        else source.review_context.review_authorization
    )
    scope = capability.historical_scope if capability else current_scope(authority.actor)
    vector = transfer_contexts(transfer)
    if permission not in scope.permissions:
        raise PermissionDenied
    if transfer.organization_id != authority.actor.organization.pk or not allows_transfer_vector(
        scope, permission, vector
    ):
        raise Http404
    if capability and capability.reviewer_actor is not None:
        current = current_scope(capability.reviewer_actor)
        # Original transport authority is historical. Reviewing the real operation
        # requires its current action and review.decide, not a new sync credential.
        required = (
            ("review_item.decide",)
            if permission == "field_event.sync"
            else (permission, "review_item.decide")
        )
        if not all(allows_transfer_vector(current, code, vector) for code in required):
            raise Http404


def paired_query(grant: Any, center: str, quadrant: str) -> Q:  # noqa: ANN401 -- shared normalized WorkScope
    result = Q(**{f"{center}__isnull": False})
    if grant["centers"]["mode"] != "all":
        result &= Q(
            **{
                f"{center}__in": grant["centers"]["ids"]
                if grant["centers"]["mode"] == "selected"
                else []
            }
        )
    if grant["quadrants"]["mode"] != "all":
        result &= Q(**{f"{quadrant}__isnull": True}) | Q(
            **{
                f"{quadrant}__in": grant["quadrants"]["ids"]
                if grant["quadrants"]["mode"] == "selected"
                else []
            }
        )
    return result


def visible_transfers(actor: UploadActor, permission: str) -> QuerySet[Any]:
    from inventory.transfers.models import Transfer, TransferLine

    query = (
        Transfer.objects.filter(organization=actor.organization)
        .select_related("origin", "destination")
        .prefetch_related("lines__lot")
    )
    allowed = Q(pk__in=[])
    for index, (codes, grant) in enumerate(current_scope(actor).grants):
        if permission not in codes:
            continue
        valid = paired_query(
            grant, "origin_version__location__center_id", "origin_version__location__quadrant_id"
        )
        valid &= paired_query(
            grant,
            "destination_version__location__center_id",
            "destination_version__location__quadrant_id",
        )
        invalid = TransferLine.objects.filter(transfer_id=OuterRef("pk")).exclude(valid)
        alias = f"_outside_binding_{index}"
        query = query.annotate(**{alias: Exists(invalid)})
        endpoints = paired_query(grant, "origin__center_id", "origin__quadrant_id")
        endpoints &= paired_query(grant, "destination__center_id", "destination__quadrant_id")
        allowed |= endpoints & Q(**{alias: False})
    return query.filter(allowed)
