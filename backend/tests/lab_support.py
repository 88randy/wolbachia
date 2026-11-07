"""Real synthetic Bag/Reading ingest; no operational method or fabricated parent."""

from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

from lab.access import LabTarget
from lab.commands import LabCommandInput, execute_lab_command
from lab.methods import decide_method, write_method
from lab.permissions import ADMIN_CODES
from organizations.models import all_scope
from organizations.services import ADMINISTRATION_PERMISSIONS
from ovitraps.models import Bag, OvitrapReading
from tests.factories import RuleParameterFactory, RuleParameterVersionFactory
from tests.ovitrap_support import CAPTURED, envelope, ingest, setup_field
from uploads.access import UploadActor

AT = CAPTURED + timedelta(hours=1)


def lab_context(monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT)
    field = setup_field()
    field.profile.permission_codes = [
        *field.profile.permission_codes,
        *ADMIN_CODES,
        *ADMINISTRATION_PERMISSIONS,
        "incident.manage_type",
        "incident.read",
        "incident.close",
    ]
    field.profile.save(update_fields=["permission_codes"])
    for module in ("lab.counting", "lab.methods", "lab.queue", "lab.recounts", "uploads.access"):
        monkeypatch.setattr(module + ".server_now", lambda: AT)
    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *_args: None)
    for key, value in (("lab_count_plausibility_limit", 1000), ("lab_recount_sample_per_100", 5)):
        parameter = RuleParameterFactory(
            organization=field.batch.organization, key=key, unit="count"
        )
        RuleParameterVersionFactory(
            parameter=parameter, value=value, effective_from=CAPTURED - timedelta(days=1)
        )
    assert ingest(field, envelope(field)).status == "accepted"
    actor = UploadActor(field.batch.user, field.batch.organization)
    return SimpleNamespace(field=field, actor=actor, member=field.membership)


def capture_bag(context, code="LAB-114", **values):
    sent = envelope(context.field, "ovitrap.check", payload={"bag_code": code, **values})
    assert ingest(context.field, sent).status == "accepted"
    reading = OvitrapReading.objects.get(event_id=sent.id)
    return Bag.objects.get(reading=reading) if reading.paddle_present else reading


def command(context, action, target, values=None, command_id=None):
    return execute_lab_command(
        context.actor, LabCommandInput(action, target, command_id or uuid4(), values or {})
    )


def receive(context, bag):
    return command(context, "receive", LabTarget("bag", bag.pk))


def count_input(context, bag, value=0, **values):
    return LabCommandInput(
        "count",
        LabTarget("bag", bag.pk),
        uuid4(),
        {"expected_revision": 0, "value": value, "confirmed_implausible": False, **values},
    )


def synthetic_method(context):
    version = write_method(
        context.actor,
        {
            "code": "SYNTHETIC-TEST-ONLY",
            "expected_revision": 0,
            "name": "Synthetic technical fixture, not operational approval",
            "procedure": "Synthetic examined-sample relationship used only to test immutable technical reporting.",
            "reference": "Synthetic test attestation, not biological certification",
            "effective_from": CAPTURED,
            "supports_viability": True,
            "supports_rejection": True,
        },
    )
    decide_method(
        context.actor,
        version.pk,
        {
            "expected_revision": 0,
            "decision": "verify",
            "reference": "Synthetic technical verification only",
        },
    )
    return version


def actor_with_codes(context, make_member, permission_codes):
    user, member = make_member(context.actor.organization, permission_codes)
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    return UploadActor(user, context.actor.organization)
