"""Order of the demo seed: every step finds its rows by code, so a rerun creates nothing twice."""

from dataclasses import dataclass

from django.conf import settings
from django.core.management.base import CommandError

from geography.models import Quadrant
from organizations.demo_seed import (
    field,
    geography,
    history,
    incidents_history,
    inventory,
    lab_history,
    operations,
    people,
    personnel,
    releases,
    training,
)
from organizations.models import Center, Membership, Organization
from uploads.access import UploadActor

LOCAL_SETTINGS_MODULES = frozenset({"config.settings.dev", "config.settings.local"})


@dataclass(frozen=True)
class DemoResult:
    organization: Organization
    members: dict[str, Membership]
    quadrants: dict[str, Quadrant]
    ovitraps: list[field.DemoOvitrap]


def require_local_settings() -> None:
    """Refuse to run unless DEBUG is on or the settings module is a local/dev one."""
    module = getattr(settings, "SETTINGS_MODULE", "")
    if not (settings.DEBUG or module in LOCAL_SETTINGS_MODULES):
        raise CommandError(
            "seed_demo only runs with DEBUG on or local/dev settings; "
            f"refusing under '{module or 'unknown settings'}'. Nothing was written."
        )


def run_demo_seed(*, reset_passwords: bool = False) -> DemoResult:
    """Build or complete the whole demo dataset (writes many tables)."""
    require_local_settings()
    organization = people.ensure_organization()
    users = people.ensure_users(organization, reset_passwords)
    members = {username: member for username, (_user, member) in users.items()}
    admin = members["demo-admin"]
    centers: dict[str, Center] = {
        center.code: center for center in people.ensure_centers(organization, admin.user)
    }
    quadrants = geography.ensure_geography(centers, admin)
    personnel.ensure_personnel(organization, members, list(centers.values()))
    operations.ensure_incident_types(
        organization,
        admin,
        {"supervisor": members["demo-supervisor"], "coordinator": members["demo-coordinator"]},
    )
    operations.ensure_motorcycles(organization, centers, admin)
    operations.ensure_assignments(quadrants, members, admin)
    device = field.ensure_device(organization)
    catalog = field.catalog_for(organization, members["demo-courier-1"].user)
    history.ensure_history(organization, members, device, catalog)
    operations.ensure_schedule(organization, admin)
    ovitraps = field.ensure_ovitraps(organization, members["demo-courier-1"].user)
    _seed_stock_and_releases(organization, members, quadrants)
    incidents_history.ensure_incidents(organization, members, quadrants)
    lab_history.ensure_lab_history(
        organization, UploadActor(members["demo-entomologist"].user, organization)
    )
    return DemoResult(organization, members, quadrants, ovitraps)


def _seed_stock_and_releases(
    organization: Organization, members: dict[str, Membership], quadrants: dict[str, Quadrant]
) -> None:
    actor = UploadActor(members["demo-admin"].user, organization)
    home = quadrants[inventory.HOME_QUADRANT]
    stock = inventory.ensure_stock(actor, home, members["demo-warehouse"])
    inventory.ensure_transit_policies(actor)
    inventory.ensure_courier_plan(actor, members["demo-courier-1"], stock)
    permit = releases.ensure_permit(organization, actor, home)
    for number in range(2, 5):
        code = f"PERMIT-DEMO-{number:02d}"
        releases.ensure_permit(organization, actor, quadrants[f"Q-DEMO-{number:02d}"], code)
    training.ensure_release_points(actor, range(2, 7))
    releases.ensure_release_device(organization, actor, stock.lots["S-DEMO-WOLB"])
    couriers = [members[name] for name in people.COURIER_USERNAMES]
    training.ensure_certifications(actor, home, couriers)
    training.ensure_release_task(actor, permit, couriers[0])
