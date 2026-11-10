"""Demo release training, courier certifications and one release task (writes via services)."""

import hashlib
import json
from dataclasses import dataclass
from datetime import timedelta
from io import BytesIO
from typing import Any
from uuid import UUID, uuid5

from django.utils import timezone
from PIL import Image

from geography.models import Block, PointVersion, Quadrant, SamplingPoint
from organizations.demo_seed.field import NAMESPACE
from organizations.models import Membership
from people.models import ActionTrainingRequirementVersion, Certification, Training, TrainingVersion
from people.permissions import PeopleContext
from people.services import PeopleWrite, write_people
from releases.models import Permit
from releases.planning import schedule_release
from releases.selectors import permit_revision
from uploads.access import UploadActor
from uploads.services import (
    LEASE_HEADER,
    UploadBody,
    UploadRequest,
    authorize_upload,
    finalize_upload,
    receive_upload,
)

COURSE_CODE = "TR-DEMO-RELEASE"
RELEASE_POINT = "Q-DEMO-01-REL-P1"
RELEASE_BLOCK = "Q-DEMO-01-B2"
ACTION = "release.record"
VALIDITY_DAYS = 90
CERTIFICATION_DAYS = 60


@dataclass(frozen=True)
class Course:
    """The training version and the context where it is required."""

    context: PeopleContext
    version: TrainingVersion


def _write(actor: UploadActor, operation: str, values: dict[str, Any]) -> Any:  # noqa: ANN401
    """One people command with a stable id; `_target` names the parent record, if any."""
    target = values.get("_target")
    values = {"expected_revision": 0, **{k: v for k, v in values.items() if k != "_target"}}
    command_id = uuid5(NAMESPACE, f"people:{operation}:{target}:{values.get('subject_id')}")
    body = json.loads(json.dumps({"command_id": str(command_id), **values}, default=str))
    return write_people(PeopleWrite(actor, command_id, operation, values, body, target))


def _evidence(actor: UploadActor) -> UUID:
    """A verified synthetic PNG, uploaded through the real upload path."""
    stream = BytesIO()
    Image.new("RGB", (3, 2), color=(30, 60, 90)).save(stream, format="PNG")
    content = stream.getvalue()
    request = UploadRequest(
        "image/png", len(content), hashlib.sha256(content).hexdigest(), None, None
    )
    answer = authorize_upload(actor, request)
    identifier = UUID(str(answer["upload_id"]))
    receive_upload(actor, UploadBody(identifier, answer["headers"][LEASE_HEADER], BytesIO(content)))
    finalize_upload(actor, identifier)
    return identifier


def _ensure_course(actor: UploadActor) -> TrainingVersion:
    course = Training.objects.filter(organization=actor.organization, code=COURSE_CODE).first()
    if course is None:
        created = _write(actor, "training.create", {"code": COURSE_CODE, "name": "Demo release"})
        course = Training.objects.get(pk=created["id"])
    existing = TrainingVersion.objects.filter(training=course).first()
    if existing is not None:
        return existing
    values = {
        "validity_seconds": VALIDITY_DAYS * 86400,
        "enabled_actions": [ACTION],
        "effective_from": timezone.now() - timedelta(days=1),
        "is_active": True,
        "_target": course.pk,
    }
    return TrainingVersion.objects.get(pk=_write(actor, "training.version", values)["id"])


def _ensure_requirement(
    actor: UploadActor, context: PeopleContext, version: TrainingVersion
) -> None:
    if ActionTrainingRequirementVersion.objects.filter(
        organization=actor.organization, action=ACTION, **context.lookups()
    ).exists():
        return
    values = {
        "action": ACTION,
        **context.lookups(),
        "effective_from": timezone.now() - timedelta(hours=1),
        "acceptable_versions": {str(version.training_id): [version.pk]},
    }
    _write(actor, "requirement.version", values)


def _ensure_certification(actor: UploadActor, course: Course, courier: Membership) -> None:
    context, version = course.context, course.version
    if Certification.objects.filter(
        organization=actor.organization, subject_id=courier.user_id, training_version=version
    ).exists():
        return
    values = {
        **context.lookups(),
        "subject_id": courier.user_id,
        "training_version_id": version.pk,
        "valid_from": timezone.now() - timedelta(hours=1),
        "valid_to": timezone.now() + timedelta(days=CERTIFICATION_DAYS),
        "evidence_ids": [_evidence(actor)],
        "issuer_reference": "Synthetic demo verification",
        "attestation": "Synthetic demo certification, not a real person",
    }
    _write(actor, "certification.issue", values)


def ensure_certifications(
    actor: UploadActor, quadrant: Quadrant, couriers: list[Membership]
) -> TrainingVersion:
    """Course, requirement for the quadrant and one valid certification per courier."""
    context = PeopleContext(quadrant.center_id, quadrant.pk)
    version = _ensure_course(actor)
    _ensure_requirement(actor, context, version)
    for courier in couriers:
        _ensure_certification(actor, Course(context, version), courier)
    return version


def _ensure_release_point(actor: UploadActor) -> SamplingPoint:
    """The point of the release task, written with the ORM and a version from yesterday.

    A release is planned for a day only if the point already existed at that day's local midnight,
    and the geography service stamps new points with the current instant. Without this backdating
    a point seeded today could only host a release tomorrow.
    """
    organization = actor.organization
    block = Block.objects.get(organization=organization, code=RELEASE_BLOCK)
    point, created = SamplingPoint.objects.get_or_create(
        organization=organization,
        code=RELEASE_POINT,
        defaults={"block": block, "created_by": actor.user},
    )
    if created:
        bounds = block.versions.order_by("-revision").get().geometry["coordinates"][0]
        east, north = bounds[2]
        PointVersion.objects.create(
            organization=organization,
            created_by=actor.user,
            point=point,
            version=1,
            location=[round(east - 0.0004, 6), round(north - 0.0004, 6)],
            effective_from=timezone.now() - timedelta(days=1, hours=timezone.localtime().hour),
        )
    return point


def ensure_release_task(actor: UploadActor, permit: Permit, courier: Membership) -> None:
    """One release task for the courier today, tied to the permit (writes; get-or-create)."""
    point = _ensure_release_point(actor)
    values = {
        "point_id": point.pk,
        "courier_id": courier.user_id,
        "due_date": timezone.localdate(),
        "expected_revision": permit_revision(permit),
    }
    schedule_release(actor, permit.pk, values)
