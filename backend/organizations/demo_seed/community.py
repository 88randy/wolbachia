"""Demo community outreach: Mérida activity types and a few promoter activities (writes)."""

from datetime import datetime, time, timedelta
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from django.http import Http404

from catalogs.models import Catalog, CatalogItem
from catalogs.services import CatalogItemSpec, create_catalog_item
from community.models import CommunityActivity
from community.permissions import authorized_block
from community.policy import CATALOG_SLUG, CREATE
from community.serializers import CreateCommunityActivitySerializer
from community.services import ActivityCommand, create_activity
from geography.models import Block
from organizations.demo_seed.custody_history import frozen_clock
from organizations.models import Membership, Organization
from uploads.access import UploadActor

ACTIVITY_TYPES = (
    CatalogItemSpec("door-to-door-talk", "Plática casa por casa", "Door-to-door talk"),
    CatalogItemSpec("school-workshop", "Taller en escuela", "School workshop"),
    CatalogItemSpec("neighborhood-meeting", "Reunión vecinal", "Neighborhood meeting"),
    CatalogItemSpec("cleanup-drive", "Jornada de descacharrización", "Container clean-up drive"),
    CatalogItemSpec("health-fair", "Feria de salud", "Health fair"),
    CatalogItemSpec("loudspeaker-notice", "Perifoneo", "Loudspeaker announcement"),
)

# (type code, days ago, attendance, agreements): aggregate and non-identifying by design.
ACTIVITIES = (
    ("door-to-door-talk", 20, 34, "Vecinos revisarán patios y cubetas cada semana."),
    ("school-workshop", 17, 85, "La escuela difundirá la liberación de mosquitos con Wolbachia."),
    ("neighborhood-meeting", 13, 22, "El comité vecinal avisará de casas cerradas."),
    ("cleanup-drive", 9, 41, "Se retiraron llantas y cacharros de dos manzanas."),
    ("health-fair", 6, 120, "Se resolvieron dudas sobre ovitrampas en domicilios."),
    ("loudspeaker-notice", 2, 0, ""),
)
NAMESPACE = uuid5(NAMESPACE_URL, "wolbachia-demo-community")


def ensure_activity_types(organization: Organization, admin: Membership) -> None:
    catalog = Catalog.objects.get(organization=organization, slug=CATALOG_SLUG)
    existing = set(CatalogItem.objects.filter(catalog=catalog).values_list("code", flat=True))
    for spec in ACTIVITY_TYPES:
        if spec.code not in existing:
            create_catalog_item(catalog, spec, admin.user)


def ensure_activities(organization: Organization, promoter: Membership) -> None:
    """A handful of past activities by the demo promoter, in blocks of their own scope."""
    if CommunityActivity.objects.filter(organization=organization).exists():
        return
    actor = UploadActor(promoter.user, organization)
    blocks = _promoter_blocks(actor, organization)
    if not blocks:
        return
    types = {
        item.code: item
        for item in CatalogItem.objects.filter(
            organization=organization, catalog__slug=CATALOG_SLUG, is_active=True
        )
    }
    zone = ZoneInfo(organization.timezone)
    today = datetime.now(tz=zone).date()
    for number, (code, days_ago, attendance, agreements) in enumerate(ACTIVITIES):
        body = CreateCommunityActivitySerializer(
            data={
                "command_id": str(uuid5(NAMESPACE, f"{organization.pk}:{number}")),
                "type_id": str(types[code].pk),
                "zone_id": str(blocks[number % len(blocks)].pk),
                "attendance": attendance,
                "agreements": agreements,
            }
        )
        body.is_valid(raise_exception=True)
        values = dict(body.validated_data)
        identifier = values.pop("command_id")
        start = datetime.combine(today - timedelta(days=days_ago), time(11, 0), tzinfo=zone)
        with frozen_clock(start):
            create_activity(ActivityCommand(actor, identifier, values))


def _promoter_blocks(actor: UploadActor, organization: Organization) -> list[Block]:
    allowed = []
    for block in Block.objects.filter(organization=organization).order_by("code")[:200]:
        try:
            allowed.append(authorized_block(actor, block.pk, CREATE))
        except Http404:
            continue
        if len(allowed) >= 3:  # noqa: PLR2004 -- a few distinct demo blocks are enough
            break
    return allowed
