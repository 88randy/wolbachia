from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from organizations.demo_seed.credentials import write_credentials
from organizations.demo_seed.run import require_local_settings, run_demo_seed


class Command(BaseCommand):
    help = (
        "LOCAL ONLY. Build (or complete) a synthetic demo organization for manual end-to-end "
        "testing: one user per profile with a fixed DEV-ONLY password, quadrants, ovitraps, "
        "fleet, supplies, a permit and a release device. Safe to run again. It refuses to run "
        "unless DEBUG is on or the settings are local/dev, writes the credentials to "
        "backend/demo-credentials.local.md (git-ignored) and never prints a password."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Set every demo user's password back to the documented DEV-ONLY value.",
        )

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        require_local_settings()
        result = run_demo_seed(reset_passwords=options["reset_passwords"])
        path = write_credentials(result)
        self.stdout.write(
            f"Demo organization '{result.organization.slug}' is ready "
            f"({len(result.members)} users, {len(result.quadrants)} quadrants, "
            f"{len(result.ovitraps)} ovitraps)."
        )
        self.stdout.write(f"Credentials and starting data: {path}")
