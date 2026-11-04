from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from organizations.models import Organization
from organizations.services import add_permission_codes_to_admin_profiles


class Command(BaseCommand):
    help = (
        "Add the device and session administration permission codes to the `admin` profile of "
        "every organization (or one with --organization). It adds every missing code, so it also gives "
        "back a code an administrator removed: run it once to backfill organizations created before "
        "these codes existed, not on every deploy."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--organization", help="Slug of a single organization.")

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        organization = None
        if options["organization"]:
            organization = Organization.objects.filter(slug=options["organization"]).first()
            if organization is None:
                raise CommandError(f"No organization with slug '{options['organization']}'.")
        changed = add_permission_codes_to_admin_profiles(organization=organization)
        self.stdout.write(f"Admin profiles updated: {changed}")
