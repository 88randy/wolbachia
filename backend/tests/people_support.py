"""Genuine B03 writers and private bytes shared by their owning boundary tests."""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID, uuid4

from PIL import Image

from catalogs.seeds import seed_default_catalogs
from geography.models import Quadrant
from organizations.models import Center, Membership, all_scope
from people.models import EvaluationRubricVersion, TrainingVersion
from people.permissions import ADMIN_CODES, PeopleContext
from people.services import PeopleWrite, write_people
from tests.review_support import audit_current_membership
from tests.sync_support import configure_clock_skew, make_phone
from uploads.access import UploadActor
from uploads.services import (
    LEASE_HEADER,
    UploadBody,
    UploadRequest,
    authorize_upload,
    finalize_upload,
    receive_upload,
)


def people_context(organization, make_member, monkeypatch, settings, tmp_path):
    clock = {"now": datetime(2026, 5, 12, 12, tzinfo=UTC)}
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock["now"])
    # Stub only the unavailable broker transport; real on_commit/domain facts remain.
    dispatched = []
    monkeypatch.setattr("people.tasks.publish_training_notice.delay", dispatched.append)
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "people-evidence"
    author, member = make_member(organization, (*ADMIN_CODES, "field.upload"))
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    phone = make_phone(make_member, organization, codes=("field.bootstrap", "field_event.sync"))
    subject = Membership.objects.get(organization=organization, user=phone.user)
    subject.scope = all_scope()
    subject.save(update_fields=["scope"])
    subject_profile = subject.profiles.get()
    subject_profile.scope = all_scope()
    subject_profile.save(update_fields=["scope"])
    center = Center.objects.create(
        organization=organization, created_by=author, code="B03-C", name="Synthetic training center"
    )
    quadrant = Quadrant.objects.create(
        organization=organization, created_by=author, center=center, code="B03-Q"
    )
    seed_default_catalogs(organization)
    configure_clock_skew(organization)
    audit_current_membership(member)
    audit_current_membership(subject)
    return SimpleNamespace(
        organization=organization,
        actor=UploadActor(author, organization),
        member=member,
        profile=profile,
        phone=phone,
        subject=subject,
        center=center,
        quadrant=quadrant,
        context=PeopleContext(center.pk, quadrant.pk),
        clock=clock,
        dispatched=dispatched,
    )


def write_person(context, operation, values, *, target=None, command_id=None):
    identifier = command_id or uuid4()
    values = {"expected_revision": 0, **values}
    body = json.loads(json.dumps({"command_id": str(identifier), **values}, default=str))
    return write_people(PeopleWrite(context.actor, identifier, operation, values, body, target))


def verified_training_evidence(context):
    stream = BytesIO()
    Image.new("RGB", (3, 2), color=(30, 60, 90)).save(stream, format="PNG")
    content = stream.getvalue()
    authorized = authorize_upload(
        context.actor,
        UploadRequest("image/png", len(content), hashlib.sha256(content).hexdigest(), uuid4()),
    )
    identifier = UUID(authorized["upload_id"])
    receive_upload(
        context.actor,
        UploadBody(identifier, authorized["headers"][LEASE_HEADER], BytesIO(content)),
    )
    assert finalize_upload(context.actor, identifier)["state"] == "verified"
    return identifier


def training_version(context, *, code="B03-COURSE", effective=None, parent=None, revision=0):
    if parent is None:
        parent = UUID(
            write_person(context, "training.create", {"code": code, "name": "Synthetic course"})[
                "id"
            ]
        )
    answer = write_person(
        context,
        "training.version",
        {
            "expected_revision": revision,
            "validity_seconds": 7 * 86400,
            "enabled_actions": ["release.record"],
            "effective_from": effective or context.clock["now"] - timedelta(days=1),
            "is_active": True,
        },
        target=parent,
    )
    return TrainingVersion.objects.get(pk=answer["id"])


def require_training(context, version, *, revision=0):
    return write_person(
        context,
        "requirement.version",
        {
            "expected_revision": revision,
            "action": "release.record",
            **context.context.lookups(),
            "effective_from": context.clock["now"] - timedelta(hours=1),
            "acceptable_versions": {str(version.training_id): [version.pk]},
        },
    )


def certify(context, version, *, start=None, end=None, evidence=None):
    return write_person(
        context,
        "certification.issue",
        {
            **context.context.lookups(),
            "subject_id": context.phone.user.pk,
            "training_version_id": version.pk,
            "valid_from": start or context.clock["now"] - timedelta(hours=1),
            "valid_to": end or context.clock["now"] + timedelta(days=2),
            "evidence_ids": [evidence or verified_training_evidence(context)],
            "issuer_reference": "Synthetic external verification",
            "attestation": "Verified synthetic fixture evidence",
        },
    )


def rubric_version(context):
    parent = UUID(
        write_person(context, "rubric.create", {"code": "B03-RUBRIC", "name": "Synthetic rubric"})[
            "id"
        ]
    )
    answer = write_person(
        context,
        "rubric.version",
        {
            "weights": {"presentation": 20, "execution": 50, "coverage": 30},
            "pass_threshold": Decimal("80"),
            "critical_checks": ["safe"],
            "effective_from": context.clock["now"] - timedelta(days=1),
        },
        target=parent,
    )
    return EvaluationRubricVersion.objects.get(pk=answer["id"])


def evaluation_values(context, version, *, score="60", safe=True, observed=None):
    return {
        **context.context.lookups(),
        "subject_id": context.phone.user.pk,
        "rubric_version_id": version.pk,
        "section_scores": {
            key: Decimal(score) for key in ("presentation", "execution", "coverage")
        },
        "critical_responses": {"safe": safe},
        "observed_at": observed or context.clock["now"],
    }
