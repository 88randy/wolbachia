import getpass
from typing import Any

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction

from accounts.models import User
from accounts.services import create_user_without_password
from platform_admin.services import grant_platform_admin


class Command(BaseCommand):
    help = (
        "Create the first platform admin (or give the platform role to an existing user). "
        "The platform role manages organizations from the web; it grants no access to any "
        "organization's data. A new user is asked for a password, never passed as an argument."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--username", required=True)
        parser.add_argument("--email", required=True)
        parser.add_argument("--first-name", default="")
        parser.add_argument("--last-name", default="")
        parser.add_argument(
            "--no-password",
            action="store_true",
            help="Do not ask for a password (set it later with `manage.py changepassword`).",
        )

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        username = options["username"]
        existing = User.objects.filter(username=username).first()
        if existing is not None and existing.email != options["email"]:
            raise CommandError("A user with that username exists with a different email.")
        password = None
        if existing is None and not options["no_password"]:
            password = self._ask_password(username, options["email"])
        with transaction.atomic():
            user = existing or create_user_without_password(username, options["email"])
            if existing is None:
                user.first_name = options["first_name"]
                user.last_name = options["last_name"]
                if password:
                    user.set_password(password)
                user.save()
            grant_platform_admin(user)
        self.stdout.write(f"'{username}' is a platform admin.")
        if existing is None and password is None:
            self.stdout.write(f"Set the password with: manage.py changepassword {username}")

    def _ask_password(self, username: str, email: str) -> str:
        first = getpass.getpass("Password: ")
        if first != getpass.getpass("Password (again): "):
            raise CommandError("The passwords do not match.")
        try:
            validate_password(first, User(username=username, email=email))
        except ValidationError as error:
            raise CommandError("; ".join(error.messages)) from error
        return first
