from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from organizations.defaults import (
    DefaultsPlan,
    plan_organization_defaults,
    seed_organization_defaults,
)
from organizations.models import Organization


class Command(BaseCommand):
    help = (
        "Show (default) or apply (--apply) the default permission codes, catalogs and rule "
        "parameters an organization is missing. Applying only adds: a permission code is granted "
        "once, only to profiles the seed created, and a code an admin revoked is never granted "
        "again. Existing catalogs, items, parameters and versions are never changed."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--organization", required=True, help="Organization slug")
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true", help="Write the changes")
        mode.add_argument(
            "--dry-run", action="store_true", help="Only print the plan (this is the default)"
        )

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401
        slug = options["organization"]
        organization = Organization.objects.filter(slug=slug).first()
        if organization is None:
            raise CommandError(f"Organization '{slug}' does not exist.")
        if options["apply"]:
            plan = seed_organization_defaults(organization)
            self.stdout.write(f"Applied to '{slug}':")
        else:
            plan = plan_organization_defaults(organization)
            self.stdout.write(f"Dry run for '{slug}' (nothing written; use --apply):")
        self._print_plan(plan)

    def _print_plan(self, plan: DefaultsPlan) -> None:
        for profile_slug, codes in plan.permissions.grants.items():
            self.stdout.write(f"  grant to profile '{profile_slug}': {', '.join(codes)}")
        for profile_slug in plan.permissions.skipped:
            self.stdout.write(
                f"  skip profile '{profile_slug}': not created by the seed, set its codes by hand"
            )
        if plan.missing_catalogs:
            self.stdout.write(f"  create catalogs: {', '.join(plan.missing_catalogs)}")
        if plan.missing_parameters:
            self.stdout.write(f"  create parameters: {', '.join(plan.missing_parameters)}")
        if self._is_empty(plan):
            self.stdout.write("  nothing to do")

    @staticmethod
    def _is_empty(plan: DefaultsPlan) -> bool:
        return not (
            plan.permissions.grants
            or plan.permissions.skipped
            or plan.missing_catalogs
            or plan.missing_parameters
        )
