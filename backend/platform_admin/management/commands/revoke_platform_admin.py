from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from accounts.models import User
from platform_admin.services import revoke_platform_admin


class Command(BaseCommand):
    help = "Remove the platform role from a user (audited). Organization memberships stay."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--username", required=True)

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        user = User.objects.filter(username=options["username"]).first()
        if user is None:
            raise CommandError("That user does not exist.")
        role = revoke_platform_admin(user)
        if role is None:
            raise CommandError("That user is not a platform admin.")
        self.stdout.write(f"'{user.username}' is no longer a platform admin.")
