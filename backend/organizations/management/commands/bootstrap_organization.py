from typing import Any

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction

from accounts.models import User
from accounts.services import create_user_without_password
from organizations.models import Profile
from organizations.services import (
    ADMIN_PROFILE_SLUG,
    OrganizationSpec,
    create_membership,
    create_organization,
)


class Command(BaseCommand):
    help = (
        "Create an organization with its default profiles and an admin user. "
        "The admin has no password: run `manage.py changepassword <username>` afterwards."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--name", required=True)
        parser.add_argument("--slug", required=True)
        parser.add_argument("--country", required=True, help="ISO 3166-1 alpha-2, e.g. MX")
        parser.add_argument("--timezone", required=True, help="IANA name, e.g. America/Mexico_City")
        parser.add_argument("--admin-username", required=True)
        parser.add_argument("--admin-email", required=True)

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        spec = OrganizationSpec(
            name=options["name"],
            slug=options["slug"],
            country=options["country"],
            timezone=options["timezone"],
        )
        try:
            with transaction.atomic():
                admin = self._get_or_create_admin(options["admin_username"], options["admin_email"])
                organization = create_organization(spec)
                admin_profile = Profile.objects.get(
                    organization=organization, slug=ADMIN_PROFILE_SLUG
                )
                create_membership(admin, organization, [admin_profile])
        except ValidationError as error:
            raise CommandError("; ".join(error.messages)) from error
        self.stdout.write(
            f"Organization '{organization.slug}' created. "
            f"Set the admin password with: manage.py changepassword {admin.username}"
        )

    def _get_or_create_admin(self, username: str, email: str) -> User:
        existing = User.objects.filter(username=username).first()
        return existing or create_user_without_password(username, email)
