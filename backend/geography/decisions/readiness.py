"""Authoritative closure blockers; no writes or inferred incident authority."""

from typing import Any

from field_sync.models import FieldEvent
from geography.decisions.scope import blocker, context
from geography.models import Quadrant
from incidents.selectors import active_blockers
from ovitraps.lifecycle.models import RelocationProposal, RemovalAttempt
from ovitraps.models import Ovitrap
from reviews.effect_receipts import effective_effects
from reviews.subject_batches import source_subject_facts
from uploads.access import UploadActor, current_scope


def _cause(reason: str, permissions: tuple[str, str], identifier: object) -> dict[str, Any]:
    permission, read_permission = permissions
    return {
        "reason": reason,
        "permission": permission,
        "read_permission": read_permission,
        "id": str(identifier),
        "link": "",
    }


def domain_blockers(quadrant: Quadrant, active: list[Ovitrap]) -> list[dict[str, Any]]:
    rows = []
    for physical in active:
        rows.append(
            _cause(
                "removal_unconfirmed", ("field_event.sync", "ovitrap.read"), physical.client_uuid
            )
        )
    for removal in RemovalAttempt.objects.filter(
        organization=quadrant.organization,
        ovitrap__sampling_point__block__quadrant=quadrant,
        is_recovered=False,
        resolution__isnull=True,
        event__voided_at__isnull=True,
    ):
        rows.append(_cause("removal_unrecovered", ("removal.resolve", "ovitrap.read"), removal.pk))
    for proposal in effective_effects(
        RelocationProposal.objects.filter(
            organization=quadrant.organization,
            ovitrap__sampling_point__block__quadrant=quadrant,
            decisions__isnull=True,
            event__voided_at__isnull=True,
        ),
        "event",
    ):
        rows.append(
            _cause("relocation_pending", ("relocation.decide", "relocation.read"), proposal.pk)
        )
    return rows


def pending_review_blockers(quadrant: Quadrant) -> list[dict[str, Any]]:
    from reviews.models import ReviewDecision

    terminal = ReviewDecision.objects.filter(
        organization=quadrant.organization, is_terminal=True
    ).values("review_item__field_event_id")
    pending = FieldEvent.objects.filter(
        organization=quadrant.organization,
        status="in_review",
        type__in=["ovitrap.remove", "ovitrap.relocate"],
        voided_at__isnull=True,
    ).exclude(pk__in=terminal)
    rows = []
    pending = pending.exclude(pk__in=effective_effects(pending).values("pk"))
    sources = list(pending)
    subjects = source_subject_facts(quadrant.organization, sources)
    for source in sources:
        facts = subjects[source.pk]
        if facts.resolved and context(quadrant) in facts.contexts:
            rows.append(
                _cause(
                    "removal_review_pending"
                    if source.type == "ovitrap.remove"
                    else "relocation_review_pending",
                    ("review_item.decide", "review_item.read"),
                    source.pk,
                )
            )
    return rows


def closure_blockers(
    actor: UploadActor, quadrant: Quadrant, active: list[Ovitrap]
) -> list[dict[str, Any]]:
    rows = domain_blockers(quadrant, active) + pending_review_blockers(quadrant)
    for hold in active_blockers(quadrant.organization).filter(
        kind="quadrant_closure", incident__quadrant=quadrant
    ):
        rows.append(
            _cause(
                "incident_quadrant_closure", ("incident.close", "incident.read"), hold.incident_id
            )
        )
    if not rows:
        return []
    scope = current_scope(actor)
    visible = [blocker(scope, quadrant, row) for row in rows]
    # Hidden references coalesce, preserving existence opacity and all distinct visible holds.
    return list({tuple(sorted(row.items())): row for row in visible}.values())
