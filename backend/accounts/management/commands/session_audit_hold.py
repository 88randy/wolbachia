"""Explicit trusted-operator session-only hold/release; defaults to dry-run."""

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from django.core.management.base import BaseCommand, CommandError, CommandParser

from accounts.models import SessionHoldPurpose
from accounts.session_audit_retention import HoldRequest, change_session_hold


class Command(BaseCommand):
    help = "Hold/release one scoped session audit; --apply is required to mutate."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--organization", type=UUID, required=True)
        parser.add_argument("--session", type=UUID, required=True)
        parser.add_argument("--purpose", choices=SessionHoldPurpose.values, required=True)
        parser.add_argument("--reference", type=UUID, required=True)
        action = parser.add_mutually_exclusive_group(required=True)
        action.add_argument("--until", type=datetime.fromisoformat)
        action.add_argument("--release", action="store_true")
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args: object, **options: Any) -> None:  # noqa: ANN401 -- Django parser boundary.
        request = HoldRequest(
            options["organization"],
            options["session"],
            options["purpose"],
            options["reference"],
            options["until"],
        )
        try:
            result = change_session_hold(request, apply=options["apply"])
        except ValueError as error:
            raise CommandError(str(error)) from error
        self.stdout.write(json.dumps(result, sort_keys=True))
