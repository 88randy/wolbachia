"""`seed_demo` (#358): rerun safety, the local-only guard and the credentials file."""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import User
from accounts.services import verify_credentials
from geography.models import Quadrant, SamplingPoint
from incidents.models import IncidentTypeVersion
from inventory.allocations.models import SupplyAssignment
from inventory.models import Lot
from organizations.demo_seed.people import DEMO_USERS
from organizations.models import Membership, Organization
from ovitraps.models import Bag, Ovitrap
from people.models import Certification
from releases.models import Permit, ReleaseDevice
from scheduling.models import AssignmentVersion, ScheduledTask
from shifts.models import Motorcycle

COUNTED = (
    User,
    Membership,
    Quadrant,
    SamplingPoint,
    Ovitrap,
    Bag,
    Motorcycle,
    AssignmentVersion,
    ScheduledTask,
    IncidentTypeVersion,
    Lot,
    SupplyAssignment,
    Permit,
    ReleaseDevice,
    Certification,
)


def counts() -> dict[str, int]:
    return {model.__name__: model.objects.count() for model in COUNTED}


# Real transactions: the permit PDF is written to private storage, which refuses to run inside a
# database transaction (the sync pipeline also commits its own locks).
@pytest.mark.django_db(transaction=True)
def test_reruns_create_nothing_twice_and_never_print_passwords(settings, tmp_path, capsys):
    settings.DEBUG = True
    settings.BASE_DIR = tmp_path
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    credentials = tmp_path / "demo-credentials.local.md"

    call_command("seed_demo")
    output = capsys.readouterr().out
    first = counts()
    call_command("seed_demo")

    assert counts() == first
    assert all(first.values()), first
    assert not any(user.password in output for user in DEMO_USERS)
    assert str(credentials) in output
    assert "demo-courier-1" in credentials.read_text(encoding="utf-8")

    courier = User.objects.get(username="demo-courier-1")
    courier.set_password("changed-by-hand")
    courier.save()
    call_command("seed_demo", "--reset-passwords")
    documented = next(user for user in DEMO_USERS if user.username == "demo-courier-1")
    assert verify_credentials("demo-courier-1", documented.password) is not None


@pytest.mark.django_db
def test_refuses_outside_local_settings_and_writes_nothing(settings, tmp_path):
    settings.DEBUG = False
    settings.SETTINGS_MODULE = "config.settings.prod"
    settings.BASE_DIR = tmp_path

    with pytest.raises(CommandError, match="only runs"):
        call_command("seed_demo")

    assert not Organization.objects.exists()
    assert not (tmp_path / "demo-credentials.local.md").exists()


@pytest.mark.django_db(transaction=True)
def test_seeded_field_events_carry_the_canonical_hash_so_every_shift_can_be_approved(
    settings, tmp_path
):
    """Review rebuilds the hash of each source event; a seed hash in another format hid the scope."""
    from field_sync.envelope import describe_payload
    from field_sync.models import FieldEvent
    from reviews.inspection import original_source_envelope
    from reviews.scope import subject_facts
    from shifts.models import Shift
    from shifts.validation import shift_blockers, shift_sources

    settings.DEBUG = True
    settings.BASE_DIR = tmp_path
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"

    call_command("seed_demo")

    wrong = [
        event.pk
        for event in FieldEvent.objects.all()
        if describe_payload(event.payload).sha256 != event.payload_sha256
    ]
    assert wrong == []
    closed = Shift.objects.filter(status="closed").select_related("motorcycle", "organization")
    assert closed.exists()
    blocked = {
        shift.code: sorted(
            {
                event.type
                for event in shift_sources(shift)
                if not subject_facts(shift.organization, original_source_envelope(event)).resolved
            }
        )
        for shift in closed
        if "shift_scope_unavailable" in shift_blockers(shift)
    }
    assert blocked == {}
