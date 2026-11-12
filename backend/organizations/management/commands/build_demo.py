from typing import Any

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import connection

from organizations.demo_seed.credentials import write_credentials
from organizations.demo_seed.run import require_local_settings, run_demo_seed

DEMO_DATABASE_PREFIX = "aedesvision_demo"


def target_database_name() -> str:
    return str(settings.DATABASES["default"]["NAME"])


def wipe_schema() -> None:
    """Drop and recreate the public schema of the default database only (destroys all data)."""
    with connection.cursor() as cursor:
        cursor.execute("DROP SCHEMA public CASCADE")
        cursor.execute("CREATE SCHEMA public")


class Command(BaseCommand):
    help = (
        "LOCAL ONLY. Build the whole demo database with one command: with --fresh it drops and "
        "recreates the schema of the target database, migrates, seeds the demo organization for "
        "every profile and writes backend/demo-credentials.local.md (git-ignored, never printed). "
        f"It refuses unless the database name starts with '{DEMO_DATABASE_PREFIX}' and --yes-wipe "
        "is given."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--fresh", action="store_true", help="Wipe the target database before seeding."
        )
        parser.add_argument(
            "--yes-wipe",
            action="store_true",
            help="Confirm that every table of the target database is destroyed.",
        )

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        require_local_settings()
        name = target_database_name()
        if not name.startswith(DEMO_DATABASE_PREFIX):
            raise CommandError(
                f"Refusing to run: database '{name}' does not start with "
                f"'{DEMO_DATABASE_PREFIX}'. Nothing was written."
            )
        if not options["fresh"]:
            raise CommandError("Pass --fresh (build_demo always starts from an empty schema).")
        if not options["yes_wipe"]:
            raise CommandError(
                f"Pass --yes-wipe to confirm that database '{name}' will be wiped. "
                "Nothing was written."
            )
        self.stdout.write(f"Wiping database '{name}'...")
        wipe_schema()
        self.stdout.write("Migrating...")
        call_command("migrate", interactive=False, verbosity=0)
        self.stdout.write("Seeding the demo...")
        result = run_demo_seed(reset_passwords=True)
        path = write_credentials(result)
        self.stdout.write(
            f"Demo organization '{result.organization.slug}' is ready "
            f"({len(result.members)} users, {len(result.quadrants)} quadrants, "
            f"{len(result.ovitraps)} ovitraps)."
        )
        self.stdout.write(f"Credentials and starting data: {path}")
