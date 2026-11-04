from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from organizations.models import Organization
from organizations.services import seed_organization_defaults


class Command(BaseCommand):
    help = (
        "Add the default permission codes, catalogs and rule parameters to an organization. "
        "Safe to run again: it only adds what is missing and never changes admin edits."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--organization", required=True, help="Organization slug")

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        slug = options["organization"]
        organization = Organization.objects.filter(slug=slug).first()
        if organization is None:
            raise CommandError(f"Organization '{slug}' does not exist.")
        seed_organization_defaults(organization)
        self.stdout.write(f"Defaults seeded for organization '{slug}'.")
