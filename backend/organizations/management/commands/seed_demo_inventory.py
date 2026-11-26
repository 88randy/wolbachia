from typing import Any

from django.core.management.base import BaseCommand, CommandError

from geography.models import Quadrant
from organizations.demo_seed.inventory import apply_inventory_additions
from organizations.demo_seed.run import require_local_settings
from organizations.models import Membership, Organization


class Command(BaseCommand):
    help = (
        "LOCAL ONLY. Apply only the inventory demo additions to an existing demo database: named "
        "storage points, the second warehouse (Almacen Poniente) and a prepared shipment "
        "(T-DEMO-01). Safe to run again; it never creates anything twice."
    )

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        require_local_settings()
        organization = Organization.objects.filter(slug="demo").first()
        if organization is None:
            raise CommandError("There is no demo organization; run seed_demo first.")
        members = {
            member.user.username: member
            for member in Membership.objects.filter(organization=organization).select_related(
                "user"
            )
        }
        quadrants = {
            quadrant.code: quadrant
            for quadrant in Quadrant.objects.filter(organization=organization)
        }
        apply_inventory_additions(organization, members, quadrants)
        self.stdout.write("Inventory demo additions are in place.")
