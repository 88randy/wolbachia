"""Authoritative closure blockers; no writes or inferred incident authority."""

from typing import Any
from uuid import UUID

from field_sync.models import FieldEvent
from geography.decisions.scope import blocker, context
from geography.models import Quadrant
from incidents.selectors import active_blockers
from organizations.models import Organization
from ovitraps.lifecycle.models import RelocationProposal, RemovalAttempt
from ovitraps.models import Ovitrap
from reviews.effect_receipts import effective_effects
from reviews.subject_batches import source_subject_facts
from uploads.access import UploadActor, current_scope


def _cause(  # noqa: PLR0913 -- one blocker row: reason, permissions, record id, human code
    reason: str,
    permissions: tuple[str, str],
    identifier: object,
    code: str = "",
) -> dict[str, Any]:
    permission, read_permission = permissions
    row = {
        "reason": reason,
        "permission": permission,
        "read_permission": read_permission,
        "id": str(identifier),
        "link": "",
    }
    if code:  # Unresolvable references are omitted, never an error.
        row["code"] = code
    return row


def _source_trap_codes(organization: Organization, sources: list[FieldEvent]) -> dict[UUID, str]:
    """Ovitrap code named by each source payload, resolved in one query."""
    named: dict[UUID, UUID] = {}
    for source in sources:
        try:
            named[source.pk] = UUID(str(source.payload["ovitrap_id"]))
        except (KeyError, TypeError, ValueError):
            continue
    codes = dict(
        Ovitrap.objects.filter(
            organization=organization, client_uuid__in=set(named.values())
        ).values_list("client_uuid", "code")
    )
    return {pk: codes[trap] for pk, trap in named.items() if trap in codes}


def domain_blockers(quadrant: Quadrant, active: list[Ovitrap]) -> list[dict[str, Any]]:
    rows = []
    for physical in active:
        rows.append(
            _cause(
                "removal_unconfirmed",
                ("field_event.sync", "ovitrap.read"),
                physical.client_uuid,
                physical.code,
            )
        )
    for removal in RemovalAttempt.objects.filter(
        organization=quadrant.organization,
        ovitrap__sampling_point__block__quadrant=quadrant,
        is_recovered=False,
        resolution__isnull=True,
        event__voided_at__isnull=True,
    ).select_related("ovitrap"):
        rows.append(
            _cause(
                "removal_unrecovered",
                ("removal.resolve", "ovitrap.read"),
                removal.pk,
                removal.ovitrap.code,
            )
        )
    for proposal in effective_effects(
        RelocationProposal.objects.filter(
            organization=quadrant.organization,
            ovitrap__sampling_point__block__quadrant=quadrant,
            decisions__isnull=True,
            event__voided_at__isnull=True,
        ).select_related("ovitrap"),
        "event",
    ):
        rows.append(
            _cause(
                "relocation_pending",
                ("relocation.decide", "relocation.read"),
                proposal.pk,
                proposal.ovitrap.code,
            )
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
    trap_codes = _source_trap_codes(quadrant.organization, sources)
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
                    trap_codes.get(source.pk, ""),
                )
            )
    return rows


def closure_blockers(
    actor: UploadActor, quadrant: Quadrant, active: list[Ovitrap]
) -> list[dict[str, Any]]:
    rows = domain_blockers(quadrant, active) + pending_review_blockers(quadrant)
    for hold in (
        active_blockers(quadrant.organization)
        .filter(kind="quadrant_closure", incident__quadrant=quadrant)
        .select_related("incident")
    ):
        code = hold.incident.code
        row = _cause(
            "incident_quadrant_closure", ("incident.close", "incident.read"), hold.incident_id, code
        )
        row["link"] = f"/incidents/{code}"
        rows.append(row)
    if not rows:
        return []
    scope = current_scope(actor)
    visible = [blocker(scope, quadrant, row) for row in rows]
    # Hidden references coalesce, preserving existence opacity and all distinct visible holds.
    return list({tuple(sorted(row.items())): row for row in visible}.values())
