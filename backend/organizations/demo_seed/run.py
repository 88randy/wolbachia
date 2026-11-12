"""Order of the demo seed: every step finds its rows by code, so a rerun creates nothing twice."""

from dataclasses import dataclass

from django.conf import settings
from django.core.management.base import CommandError

from accounts.models import Device
from geography.models import Quadrant
from inventory.models import Location, Lot
from organizations.demo_seed import (
    community,
    custody_history,
    field,
    flows,
    geography,
    history,
    incidents_history,
    inventory,
    lab_history,
    operations,
    pcr_history,
    people,
    personnel,
    samples_history,
)
from organizations.demo_seed.resilience import release_stale_sessions, retrying
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


def _ensure_flows(
    organization: Organization, members: dict[str, Membership], device: Device
) -> None:
    """Delivery states, warehouse transfers in every state and the fleet service history."""
    admin = UploadActor(members["demo-admin"].user, organization)
    flows.ensure_delivery_states(organization, admin)
    locations = Location.objects.filter(organization=organization)
    route = (
        locations.get(code=inventory.LOCATION_CODE),
        locations.get(code=inventory.SECOND_WAREHOUSE_CODE),
    )
    lot = Lot.objects.get(organization=organization, code="L-MER-BAG")
    flows.ensure_transfer_flow(organization, members, device, lot, route)
    flows.ensure_fleet_services(organization, members["demo-admin"])


def run_demo_seed(*, reset_passwords: bool = False) -> DemoResult:
    """Build or complete the whole demo dataset (writes many tables)."""
    require_local_settings()
    with custody_history.frozen_clock(custody_history.history_start()):
        organization = people.ensure_organization()
        users = people.ensure_users(organization, reset_passwords)
        people.ensure_platform_admin(reset_passwords)
    members = {username: member for username, (_user, member) in users.items()}
    admin = members["demo-admin"]
    centers: dict[str, Center] = {
        center.code: center for center in people.ensure_centers(organization, admin.user)
    }
    with custody_history.frozen_clock(custody_history.history_start()):
        quadrants = retrying(lambda: geography.ensure_geography(centers, admin))
    personnel.ensure_personnel(organization, members, list(centers.values()))
    operations.ensure_incident_types(
        organization,
        admin,
        {"supervisor": members["demo-supervisor"], "coordinator": members["demo-coordinator"]},
    )
    operations.ensure_motorcycles(organization, centers, admin)
    operations.ensure_public_portal(organization, admin)
    with custody_history.frozen_clock(custody_history.history_start()):
        retrying(lambda: operations.ensure_assignments(quadrants, members, admin))
    device = field.ensure_device(organization)
    catalog = field.catalog_for(organization, members["demo-courier-1"].user)
    release_stale_sessions()
    retrying(lambda: history.ensure_history(organization, members, device, catalog))
    retrying(lambda: operations.ensure_schedule(organization, admin))
    ovitraps = retrying(lambda: field.ensure_ovitraps(organization, members["demo-courier-1"].user))
    retrying(
        lambda: custody_history.ensure_stock_and_releases(
            organization, members, quadrants, catalog["version"], device
        )
    )
    retrying(lambda: _ensure_flows(organization, members, device))
    retrying(lambda: samples_history.ensure_samples(organization, members, device, catalog))
    retrying(lambda: incidents_history.ensure_incidents(organization, members, quadrants))
    flows.ensure_notifications(organization, members)
    community.ensure_activity_types(organization, admin)
    retrying(lambda: community.ensure_activities(organization, members["demo-promoter"]))
    entomologist = UploadActor(members["demo-entomologist"].user, organization)
    lab_history.ensure_lab_history(organization, entomologist)
    retrying(lambda: pcr_history.ensure_pcr_history(organization, members, device))
    return DemoResult(organization, members, quadrants, ovitraps)
