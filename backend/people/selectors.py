"""Current authorization is applied before count/order/page, independently of qualification."""

from typing import cast
from uuid import UUID

from django.db.models import Exists, IntegerField, Model, OuterRef, Q, QuerySet, Subquery, Value
from django.db.models.functions import Coalesce, Greatest
from django.http import Http404

from core.time import server_now
from organizations.models import Membership
from organizations.scope import EffectiveScope
from people.models import (
    Certification,
    CertificationRevocation,
    Evaluation,
    EvaluationAttempt,
    EvaluationCompletion,
    EvaluationRubric,
    EvaluationRubricVersion,
    EvaluationVoid,
    Training,
    TrainingVersion,
)
from people.permissions import PeopleContext
from uploads.access import UploadActor, current_scope


def scoped_facts[Fact: Model](
    rows: QuerySet[Fact], scope: EffectiveScope, permission: str
) -> QuerySet[Fact]:
    allowed = Q(pk__in=[])
    for codes, bound in scope.grants:
        if permission not in codes:
            continue
        grant = Q(pk__isnull=False)
        if bound["centers"]["mode"] != "all":
            grant &= Q(
                center_id__in=bound["centers"]["ids"]
                if bound["centers"]["mode"] == "selected"
                else []
            )
        if bound["quadrants"]["mode"] != "all":
            grant &= Q(quadrant_id__isnull=True) | Q(
                quadrant_id__in=bound["quadrants"]["ids"]
                if bound["quadrants"]["mode"] == "selected"
                else []
            )
        allowed |= grant
    return rows.filter(allowed)


def subject_certifications(
    actor: UploadActor, subject_id: UUID, permission: str
) -> QuerySet[Certification]:
    rows = cast(
        QuerySet[Certification],
        Certification.objects.filter(organization=actor.organization, subject_id=subject_id),
    )
    return (
        scoped_facts(rows, current_scope(actor), permission)
        .annotate(
            _read_revision=Coalesce(
                Subquery(
                    CertificationRevocation.objects.filter(certification_id=OuterRef("pk"))
                    .order_by("-revision")
                    .values("revision")[:1]
                ),
                Value(1),
            ),
            _revoked_from=Subquery(
                CertificationRevocation.objects.filter(certification_id=OuterRef("pk"))
                .order_by("effective_from", "pk")
                .values("effective_from")[:1]
            ),
        )
        .select_related("training_version__training")
        .prefetch_related("revocations")
        .order_by("-created_at", "id")
    )


def scoped_evaluations(actor: UploadActor, permission: str) -> QuerySet[Evaluation]:
    rows = cast(QuerySet[Evaluation], Evaluation.objects.filter(organization=actor.organization))
    attempts = EvaluationAttempt.objects.filter(evaluation_id=OuterRef("pk")).order_by("-revision")
    voids = EvaluationVoid.objects.filter(evaluation_id=OuterRef("pk"))
    return (
        scoped_facts(rows, current_scope(actor), permission)
        .select_related("void_record")
        .annotate(
            **{"_current_attempt_id": Subquery(attempts.values("id")[:1])},
            _read_revision=Greatest(
                Coalesce(Subquery(attempts.values("revision")[:1]), Value(0)),
                Coalesce(Subquery(voids.values("revision")[:1]), Value(0)),
            ),
            _is_voided=Exists(voids),
        )
        .order_by("-created_at", "id")
    )


def training_definitions(organization_id: UUID) -> QuerySet[Training]:
    versions = TrainingVersion.objects.filter(training_id=OuterRef("pk"))
    return cast(
        QuerySet[Training],
        (
            Training.objects.filter(organization_id=organization_id)
            .annotate(
                _read_revision=Coalesce(
                    Subquery(versions.order_by("-version").values("version")[:1]),
                    Value(0),
                    output_field=IntegerField(),
                ),
                _current_version_id=Subquery(
                    versions.filter(effective_from__lte=server_now())
                    .order_by("-effective_from", "-version")
                    .values("id")[:1]
                ),
            )
            .order_by("code", "id")
        ),
    )


def rubric_definitions(organization_id: UUID) -> QuerySet[EvaluationRubric]:
    versions = EvaluationRubricVersion.objects.filter(rubric_id=OuterRef("pk"))
    return cast(
        QuerySet[EvaluationRubric],
        (
            EvaluationRubric.objects.filter(organization_id=organization_id)
            .annotate(
                _read_revision=Coalesce(
                    Subquery(versions.order_by("-version").values("version")[:1]),
                    Value(0),
                    output_field=IntegerField(),
                ),
                _current_version_id=Subquery(
                    versions.filter(effective_from__lte=server_now())
                    .order_by("-effective_from", "-version")
                    .values("id")[:1]
                ),
            )
            .order_by("code", "id")
        ),
    )


def read_attempts(rows: list[Evaluation]) -> dict[UUID, EvaluationAttempt]:
    identifiers = [row._current_attempt_id for row in rows]
    return {
        attempt.evaluation_id: attempt
        for attempt in EvaluationAttempt.objects.filter(pk__in=identifiers).select_related(
            "completion"
        )
    }


def current_attempt(evaluation: Evaluation) -> EvaluationAttempt:
    attempt = evaluation.attempts.order_by("-revision").first()
    if attempt is None:
        raise Http404
    return cast(EvaluationAttempt, attempt)


def completion_sequence(organization_id: UUID, subject_id: UUID) -> int:
    row = (
        EvaluationCompletion.objects.filter(organization_id=organization_id, subject_id=subject_id)
        .order_by("-sequence")
        .first()
    )
    return 0 if row is None else row.sequence


def active_completions(organization_id: UUID, subject_id: UUID) -> QuerySet[EvaluationCompletion]:
    superseding = EvaluationAttempt.objects.filter(predecessor_id=OuterRef("attempt_id"))
    voided = EvaluationVoid.objects.filter(evaluation_id=OuterRef("attempt__evaluation_id"))
    return cast(
        QuerySet[EvaluationCompletion],
        (
            EvaluationCompletion.objects.filter(
                organization_id=organization_id, subject_id=subject_id
            )
            .annotate(
                _superseded=Exists(superseding),
                _voided=Exists(voided),
            )
            .filter(_superseded=False, _voided=False)
            .select_related("attempt__evaluation")
            .order_by("sequence")
        ),
    )


def historical_subject(actor: UploadActor, identifier: UUID) -> None:
    if not Membership.objects.filter(organization=actor.organization, user_id=identifier).exists():
        raise Http404


def certificate_context(certificate: Certification) -> PeopleContext:
    return PeopleContext(certificate.center_id, certificate.quadrant_id)


def certification_revision(certificate: Certification) -> int:
    last = (
        CertificationRevocation.objects.filter(certification=certificate)
        .order_by("-revision")
        .first()
    )
    return 1 if last is None else last.revision
