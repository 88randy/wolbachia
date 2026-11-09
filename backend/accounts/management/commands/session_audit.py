"""Read one minimal scoped session audit; no public API or subject resolution."""

import json
from typing import Any
from uuid import UUID

from django.core.management.base import BaseCommand, CommandError, CommandParser

from accounts.session_audit_retention import session_audit


class Command(BaseCommand):
    help = "Read minimal session audit by exact organization and session UUID."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--organization", type=UUID, required=True)
        parser.add_argument("--session", type=UUID, required=True)
        parser.add_argument("--state", choices=("unclassified", "ended", "dissociated"))

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401 -- Django parser boundary.
        try:
            result = session_audit(options["organization"], options["session"])
        except ValueError as error:
            raise CommandError(str(error)) from error
        if options["state"] is not None and options["state"] != result["state"]:
            raise CommandError("Unknown organization/session/state.")
        self.stdout.write(json.dumps(result, sort_keys=True))
