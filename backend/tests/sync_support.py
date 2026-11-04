"""Helpers shared by the sync tests: a logged-in phone and event/batch builders."""

import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.db import connection
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient

from accounts.models import User
from accounts.services import DeviceInfo, start_device_session
from accounts.token_pairs import IssuedTokens
from field_sync.permissions import FIELD_EVENT_SYNC
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import RuleParameterFactory, RuleParameterVersionFactory

SYNC = "/api/v1/field/sync/"
SKEW_KEY = "clock_skew_review_seconds"
SKEW_THRESHOLD = 300


@dataclass
class Phone:
    """A user logged in on a device (mobile session) with a ready API client."""

    client: APIClient
    user: User
    organization: Organization
    device_id: uuid.UUID
    issued: IssuedTokens

    def sync(self, events: list[dict[str, Any]], **overrides: Any) -> Response:  # noqa: ANN401
        return self.client.post(SYNC, batch(self, events, **overrides), format="json")


def make_phone(
    make_member: MemberFactory,
    organization: Organization,
    codes: tuple[str, ...] = (FIELD_EVENT_SYNC,),
    user: User | None = None,
    device_id: uuid.UUID | None = None,
) -> Phone:
    user, _ = make_member(organization, codes, user=user)
    device_id = device_id or uuid.uuid4()
    issued = start_device_session(user, organization, DeviceInfo(device_id=device_id))
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    return Phone(client, user, organization, device_id, issued)


def second_device_of(phone: Phone) -> Phone:
    """The same user logged in on another phone."""
    device_id = uuid.uuid4()
    issued = start_device_session(phone.user, phone.organization, DeviceInfo(device_id=device_id))
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    return Phone(client, phone.user, phone.organization, device_id, issued)


def event(**overrides: Any) -> dict[str, Any]:  # noqa: ANN401
    """A valid `test.note` event; override any envelope field (`payload`, `type`, ...)."""
    base: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "type": "test.note",
        "schema_version": 1,
        "device_time": timezone.now().isoformat(),
        "payload": {"text": "hello"},
        "rules_version": "rules-1",
        "catalog_version": "catalog-1",
        "manual_capture": False,
    }
    return {**base, **overrides}


def batch(phone: Phone, events: list[dict[str, Any]], **overrides: Any) -> dict[str, Any]:  # noqa: ANN401
    base: dict[str, Any] = {
        "device_id": str(phone.device_id),
        "sent_at": timezone.now().isoformat(),
        "events": events,
    }
    return {**base, **overrides}


def run_in_threads(*jobs: Callable[[], Any]) -> list[Any]:
    """Run jobs at the same moment, each with its own database connection.

    Returns each job's result (the exception object when it raised). Fails when a job hangs,
    which is what a deadlock looks like. Use with `django_db(transaction=True)`.
    """
    outcomes: list[Any] = [None] * len(jobs)
    barrier = threading.Barrier(len(jobs))

    def runner(position: int, job: Callable[[], Any]) -> None:
        try:
            barrier.wait(timeout=10)
            outcomes[position] = job()
        except Exception as error:  # noqa: BLE001 - the test inspects whatever happened
            outcomes[position] = error
        finally:
            connection.close()

    threads = [
        threading.Thread(target=runner, args=(position, job)) for position, job in enumerate(jobs)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    assert not any(thread.is_alive() for thread in threads), "a thread is stuck: deadlock?"
    return outcomes


def configure_clock_skew(organization: Organization, seconds: int = SKEW_THRESHOLD) -> None:
    """Give the organization a `clock_skew_review_seconds` value in force since yesterday."""
    parameter = RuleParameterFactory(organization=organization, key=SKEW_KEY)
    RuleParameterVersionFactory(
        parameter=parameter, value=seconds, effective_from=timezone.now() - timedelta(days=1)
    )
