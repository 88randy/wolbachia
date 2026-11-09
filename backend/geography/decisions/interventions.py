"""Third-party metadata never creates company release or biological authority."""

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from catalogs.models import Catalog, CatalogItem
from core.exceptions import FieldValidationError
from geography.decisions.models import ThirdPartyIntervention, ThirdPartyInterventionBlock
from geography.decisions.scope import allows, require_contexts
from geography.decisions.transactions import WriteScope, geography_transaction
from geography.models import Block
from geography.permissions import INTERVENTION_CREATE, INTERVENTION_READ
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class InterventionRequest:
    type: UUID
    product: str
    source: str
    blocks: tuple[UUID, ...]
    date_from: date
    date_to: date
    other_text: str = ""


def _blocks(actor: UploadActor, identifiers: tuple[UUID, ...]) -> list[Block]:
    if not current_scope(actor).allows(INTERVENTION_CREATE):
        raise PermissionDenied
    rows = list(
        Block.objects.filter(organization=actor.organization, pk__in=identifiers).select_related(
            "quadrant"
        )
    )
    if len(rows) != len(set(identifiers)):
        raise Http404
    if not rows:
        raise FieldValidationError("blocks", "required")
    require_contexts(actor, INTERVENTION_CREATE, (row.quadrant for row in rows))
    return rows


def create_intervention(actor: UploadActor, request: InterventionRequest) -> ThirdPartyIntervention:
    rows = _blocks(actor, request.blocks)
    with geography_transaction(
        actor, WriteScope(INTERVENTION_CREATE, tuple(row.quadrant for row in rows))
    ):
        rows = _blocks(actor, request.blocks)
        catalog = Catalog.objects.filter(
            organization=actor.organization, slug="intervention-type"
        ).first()
        if catalog is None:
            raise FieldValidationError("type", "not_configured")
        Catalog.objects.select_for_update(nowait=True, no_key=True).get(pk=catalog.pk)
        item = CatalogItem.objects.filter(
            organization=actor.organization, catalog=catalog, pk=request.type, is_active=True
        ).first()
        if item is None:
            raise Http404
        _validate_metadata(item, request)
        list(
            Block.objects.filter(pk__in=[row.pk for row in rows])
            .order_by("pk")
            .select_for_update(nowait=True, no_key=True)
        )
        intervention = ThirdPartyIntervention.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            type=item,
            type_code=item.code,
            type_label={"es": item.label_es, "en": item.label_en},
            product=request.product.strip(),
            source=request.source.strip(),
            date_from=request.date_from,
            date_to=request.date_to,
            other_text=request.other_text.strip(),
        )
        for block in sorted(rows, key=lambda row: row.pk):
            ThirdPartyInterventionBlock.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                intervention=intervention,
                block=block,
            )
        return intervention


def _validate_metadata(item: CatalogItem, request: InterventionRequest) -> None:
    if request.date_to < request.date_from:
        raise FieldValidationError("date_to", "invalid_date_range")
    if not request.product.strip() or not request.source.strip():
        raise FieldValidationError("product", "required")
    if item.is_other and not request.other_text.strip():
        raise FieldValidationError("other_text", "required")
    if not item.is_other and request.other_text.strip():
        raise FieldValidationError("other_text", "not_applicable")


def visible_interventions(actor: UploadActor) -> QuerySet[ThirdPartyIntervention]:
    scope = current_scope(actor)
    links = ThirdPartyInterventionBlock.objects.filter(
        organization=actor.organization
    ).select_related("block__quadrant")
    hidden = {
        link.intervention_id
        for link in links
        if not allows(scope, INTERVENTION_READ, link.block.quadrant)
    }
    return (
        ThirdPartyIntervention.objects.filter(organization=actor.organization, blocks__isnull=False)
        .exclude(pk__in=hidden)
        .distinct()
        .prefetch_related("blocks")
    )
