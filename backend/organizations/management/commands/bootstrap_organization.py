from typing import Any

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError, CommandParser

from core.exceptions import DomainError
from organizations.services import AdminSpec, OrganizationSpec, bootstrap_organization


class Command(BaseCommand):
    help = (
        "Create an organization with its default profiles and an admin user. "
        "A new admin has no password: run `manage.py changepassword <username>` afterwards."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--name", required=True)
        parser.add_argument("--slug", required=True)
        parser.add_argument("--country", required=True, help="ISO 3166-1 alpha-2, e.g. MX")
        parser.add_argument("--timezone", required=True, help="IANA name, e.g. America/Mexico_City")
        parser.add_argument("--admin-username", required=True)
        parser.add_argument("--admin-email", required=True)
        parser.add_argument(
            "--reuse-existing-user",
            action="store_true",
            help="Reuse an existing user with that username even if its email differs.",
        )

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        spec = OrganizationSpec(
            name=options["name"],
            slug=options["slug"],
            country=options["country"],
            timezone=options["timezone"],
        )
        admin = AdminSpec(
            username=options["admin_username"],
            email=options["admin_email"],
            reuse_existing_user=options["reuse_existing_user"],
        )
        try:
            organization, user = bootstrap_organization(spec, admin)
        except ValidationError as error:
            raise CommandError("; ".join(error.messages)) from error
        except DomainError as error:
            raise CommandError(error.detail) from error
        self.stdout.write(
            f"Organization '{organization.slug}' created. "
            f"Set the admin password with: manage.py changepassword {user.username}"
        )
