"""Current request identity and one blindness predicate; callers retain their read ACL."""

from typing import Any, cast
from uuid import UUID

from django.db.models import (
    BigIntegerField,
    Case,
    CharField,
    Count,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Q,
    QuerySet,
    Subquery,
    Value,
    When,
)
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Abs, Cast, Coalesce, Greatest
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from core.time import server_now
from lab.access import scoped_bags, scoped_readings
from lab.models import (
    EggCountAttempt,
    LabBlindObservation,
    LabMethodVersion,
    LabNumericDisclosure,
    LabQAPolicyVersion,
    LabResultRevision,
    PaddleReuse,
    RecountAttempt,
    RecountClaim,
    RecountIndependenceAttestation,
    RecountRequest,
    RecountRequestCause,
    RecountResolution,
    RecountRevision,
)
from lab.permissions import RECOUNT_ADJUDICATE, RECOUNT_CREATE
from ovitraps.models import Bag
from uploads.access import UploadActor


def request_rows(actor: UploadActor, permissions: tuple[str, ...]) -> QuerySet[RecountRequest]:
    permitted = Q(pk__in=[])
    for permission in permissions:
        permitted |= Q(count__bag__in=scoped_bags(actor, permission))
    return RecountRequest.objects.filter(organization=actor.organization).filter(permitted)


def request_for_action(
    actor: UploadActor, identifier: UUID, permissions: tuple[str, ...]
) -> RecountRequest:
    return get_object_or_404(
        request_rows(actor, permissions).select_related(
            "count__bag__reading__event", "count__receipt", "count__result_revision"
        ),
        pk=identifier,
    )


def current_qa_revision(request: RecountRequest) -> int:
    current = RecountRevision.objects.filter(request=request).first()
    return 0 if current is None else current.revision


def current_first_result(request: RecountRequest) -> LabResultRevision | None:
    return LabResultRevision.objects.filter(bag=request.count.bag).first()


def obligation_resolution(
    request: RecountRequest, current: LabResultRevision
) -> RecountResolution | None:
    if current.count_id != request.count_id or hasattr(request, "supersession"):
        return None
    resolution = (
        RecountResolution.objects.filter(request=request, first_result=current)
        .order_by("-qa_revision__revision")
        .first()
    )
    if resolution is None or resolution.comparison_proof.get("cause_ids") != cause_ids(request):
        return None
    return cast(RecountResolution, resolution)


def cause_ids(request: RecountRequest) -> list[str]:
    return [
        str(identifier) for identifier in request.causes.order_by("pk").values_list("pk", flat=True)
    ]


def matching_cause_rows(rows: QuerySet[Any], proof_field: str) -> QuerySet[Any]:
    """Append-only causes cannot be deleted/replaced: count change invalidates the frame in SQL."""
    causes = (
        RecountRequestCause.objects.filter(request_id=OuterRef("request_id"))
        .values("request_id")
        .annotate(total=Count("pk"))
        .values("total")
    )
    return cast(
        QuerySet[Any],
        rows.annotate(
            _proof_cause_count=Cast(KeyTextTransform("cause_count", proof_field), IntegerField()),
            _actual_cause_count=Subquery(causes[:1]),
        ).filter(_proof_cause_count=F("_actual_cause_count")),
    )


def role_authorized(actor: UploadActor, request: RecountRequest, role: str) -> bool:
    actions = (RECOUNT_CREATE, RECOUNT_ADJUDICATE) if role == "third" else (RECOUNT_CREATE,)
    try:
        return actor.user.is_active and all(
            scoped_readings(actor, action).filter(pk=request.count.receipt.reading_id).exists()
            for action in actions
        )
    except PermissionDenied:
        return False


def eligibility_reason(actor: UploadActor, request: RecountRequest, role: str) -> str | None:
    # Replacements retain this physical Bag's observation lineage. Neither a new
    # UUID nor an administrative correction can erase authorship/exposure.
    if EggCountAttempt.objects.filter(bag=request.count.bag, created_by=actor.user).exists():
        return "lab_recount_self"
    if LabNumericDisclosure.objects.filter(
        count__bag=request.count.bag, created_by=actor.user
    ).exists():
        return "lab_recount_disclosed"
    if (
        role == "third"
        and RecountAttempt.objects.filter(
            request=request, role="second", created_by=actor.user
        ).exists()
    ):
        return "lab_recount_distinct_required"
    if not LabBlindObservation.objects.filter(count=request.count).exists() and not (
        RecountIndependenceAttestation.objects.filter(
            request=request,
            first_result=request.count.result_revision,
            counter=actor.user,
            role=role,
            authority_proof__cause_ids=cause_ids(request),
        ).exists()
    ):
        return "lab_independence_unproven"
    return None


def blind_visible_counts(
    actor: UploadActor, rows: QuerySet[EggCountAttempt]
) -> QuerySet[EggCountAttempt]:
    """Apply before filters/order/count/page; this predicate grants no underlying read permission."""
    disclosed = LabNumericDisclosure.objects.filter(
        count__bag_id=OuterRef("bag_id"), created_by=actor.user
    )
    authored = EggCountAttempt.objects.filter(bag_id=OuterRef("bag_id"), created_by=actor.user)
    completed = RecountAttempt.objects.filter(
        request__count_id=OuterRef("pk"), created_by=actor.user
    )
    return rows.alias(
        qa_disclosed=Exists(disclosed),
        qa_authored=Exists(authored),
        qa_completed_own=Exists(completed),
    ).exclude(
        Q(bag__in=scoped_bags(actor, RECOUNT_CREATE))
        & ~Q(created_by=actor.user)
        & Q(qa_disclosed=False, qa_authored=False, qa_completed_own=False)
    )


def can_read_numeric(actor: UploadActor, count: EggCountAttempt) -> bool:
    return blind_visible_counts(actor, EggCountAttempt.objects.filter(pk=count.pk)).exists()


def blind_visible_bags(actor: UploadActor, rows: QuerySet[Bag]) -> QuerySet[Bag]:
    current = LabResultRevision.objects.filter(bag_id=OuterRef("pk")).order_by("-revision")
    visible = blind_visible_counts(
        actor, EggCountAttempt.objects.filter(organization=actor.organization)
    ).values("pk")
    return rows.alias(_numeric_first=Subquery(current.values("count_id")[:1])).filter(
        Q(_numeric_first__isnull=True) | Q(_numeric_first__in=visible)
    )


def filter_history_numbers(actor: UploadActor, rows: QuerySet[Any]) -> QuerySet[Any]:
    """Blind numeric/inferential rows are removed in SQL before the history owner's LIMIT."""
    from lab.permissions import COUNT_READ

    visible = (
        blind_visible_counts(
            actor,
            EggCountAttempt.objects.filter(
                organization=actor.organization,
                receipt__reading__in=scoped_readings(actor, COUNT_READ),
            ),
        )
        .annotate(_lab_count_text=Cast("pk", CharField()))
        .values("_lab_count_text")
    )
    numeric = [
        "history." + kind
        for kind in ("lab_count", "lab_void", "lab_recount", "lab_adjudication", "lab_paddle_reuse")
    ]
    return cast(
        QuerySet[Any],
        rows.alias(_lab_count_text=KeyTextTransform("count_id", "payload")).filter(
            ~Q(resource_type__in=numeric)
            | Q(resource_type="history.lab_void", _lab_count_text__isnull=True)
            | Q(_lab_count_text__in=visible)
        ),
    )


def visibility_revision(actor: UploadActor) -> str:
    """Immutable self observation counts invalidate cached hidden history when it opens.

    Permission changes are already in the captured generation. Disclosure does not
    open a previously hidden value: publication itself requires existing eligibility.
    """
    from core.snapshots import snapshot_hash

    return snapshot_hash(
        {
            "first_authored": EggCountAttempt.objects.filter(
                organization=actor.organization, created_by=actor.user
            ).count(),
            "independent_committed": RecountAttempt.objects.filter(
                organization=actor.organization, created_by=actor.user
            ).count(),
        }
    )


def policy_projection(policy: LabQAPolicyVersion | None) -> dict[str, Any]:
    qa = (
        "unconfigured"
        if policy is None
        else method_availability(policy.qa_method_version, "independent_qa")
    )
    reuse = (
        "unconfigured"
        if policy is None
        else method_availability(policy.reuse_method_version, "paddle_reuse")
    )
    return {
        "revision": 0 if policy is None else policy.revision,
        "policy": None
        if policy is None
        else {
            "id": str(policy.pk),
            "absolute_tolerance": policy.absolute_tolerance,
            "relative_per_100": policy.relative_per_100,
            "qa_method_version": None
            if policy.qa_method_version_id is None
            else str(policy.qa_method_version_id),
            "reuse_method_version": None
            if policy.reuse_method_version_id is None
            else str(policy.reuse_method_version_id),
            "content_hash": policy.content_hash,
        },
        "availability": "configured" if qa == reuse == "configured" else "unavailable",
        "qa_availability": qa,
        "reuse_availability": reuse,
    }


def method_availability(version: LabMethodVersion | None, capability: str) -> str:
    if version is None:
        return "unconfigured"
    current = (
        LabMethodVersion.objects.filter(method=version.method, effective_from__lte=server_now())
        .order_by("-effective_from", "-revision")
        .first()
    )
    verified = version.verifications.first()
    if (
        current is None
        or current.pk != version.pk
        or not version.procedure.strip()
        or not version.reference.strip()
        or verified is None
        or verified.decision != "verify"
        or verified.content_hash != version.content_hash
        or not getattr(version, "supports_" + capability, False)
    ):
        return "unverified"
    return "configured"


def execution_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Any]:
    """Only server-owned nonnumeric states/facets precede pagination."""
    from inventory.allocations.models import BagDisposition

    second = RecountAttempt.objects.filter(request_id=OuterRef("pk"), role="second")
    third = RecountAttempt.objects.filter(request_id=OuterRef("pk"), role="third")
    result = LabResultRevision.objects.filter(bag_id=OuterRef("count__bag_id")).order_by(
        "-revision"
    )
    revisions = RecountRevision.objects.filter(request_id=OuterRef("pk"))
    rows = (
        request_rows(actor, (RECOUNT_CREATE, RECOUNT_ADJUDICATE))
        .annotate(
            qa_second=Exists(second),
            qa_third=Exists(third),
            qa_resolved=Exists(
                matching_cause_rows(
                    RecountResolution.objects.filter(request_id=OuterRef("pk")), "comparison_proof"
                )
            ),
            qa_disposed=Exists(BagDisposition.objects.filter(bag_id=OuterRef("count__bag_id"))),
            qa_treated=Exists(
                PaddleReuse.objects.filter(binding__bag_id=OuterRef("count__bag_id"))
            ),
            qa_first_current=Subquery(result.values("count_id")[:1]),
            qa_result_revision=Coalesce(Subquery(result.values("revision")[:1]), Value(0)),
            qa_revision=Coalesce(Subquery(revisions.values("revision")[:1]), Value(0)),
            qa_second_value=Subquery(second.values("value")[:1]),
            qa_absolute=Subquery(second.values("claim__policy__absolute_tolerance")[:1]),
            qa_relative=Subquery(second.values("claim__policy__relative_per_100")[:1]),
        )
        .alias(
            qa_difference=Abs(F("count__value") - F("qa_second_value"))
            * Value(100, output_field=BigIntegerField()),
            qa_threshold=Greatest(F("qa_absolute") * 100, F("qa_relative") * F("count__value")),
        )
    )
    policy = LabQAPolicyVersion.objects.filter(organization=actor.organization).first()
    ready = (
        policy is not None
        and method_availability(policy.qa_method_version, "independent_qa") == "configured"
    )
    rows = rows.annotate(
        qa_state=Case(
            When(
                Q(supersession__isnull=False)
                | Q(qa_first_current__isnull=True)
                | ~Q(qa_first_current=F("count_id")),
                then=Value("superseded"),
            ),
            When(Q(qa_disposed=True) | Q(qa_treated=True), then=Value("awaiting_material")),
            When(qa_resolved=True, then=Value("resolved")),
            When(then=Value("awaiting_configuration"), condition=Value(not ready)),
            When(
                qa_second=True,
                qa_third=False,
                qa_difference__gt=F("qa_threshold"),
                then=Value("awaiting_third"),
            ),
            When(qa_second=True, then=Value("awaiting_selection")),
            default=Value("awaiting_second"),
            output_field=CharField(),
        )
    )
    lookups = {
        "center": "count__bag__reading__ovitrap__sampling_point__block__quadrant__center_id",
        "quadrant": "count__bag__reading__ovitrap__sampling_point__block__quadrant_id",
        "code": "count__bag__code",
        "state": "qa_state",
    }
    return (
        rows.filter(**{lookup: values[key] for key, lookup in lookups.items() if key in values})
        .select_related("count__bag", "count__receipt")
        .order_by(values.get("ordering", "created_at"), "id")
    )


def request_state(request: RecountRequest) -> str:
    current = current_first_result(request)
    if hasattr(request, "supersession") or current is None or current.count_id != request.count_id:
        return "superseded"
    from inventory.allocations.bag_dependencies import material_availability

    if (
        not material_availability(request.count.bag)["available"]
        or PaddleReuse.objects.filter(binding__bag=request.count.bag).exists()
    ):
        return "awaiting_material"
    if obligation_resolution(request, current) is not None:
        return "resolved"
    policy = LabQAPolicyVersion.objects.filter(organization=request.organization).first()
    if (
        policy is None
        or method_availability(policy.qa_method_version, "independent_qa") != "configured"
    ):
        return "awaiting_configuration"
    second = RecountAttempt.objects.filter(request=request, role="second").first()
    if second is None:
        return "awaiting_second"
    from lab.independent_qa.policies import RecountComparison, requires_third

    policy = second.claim.policy
    required = requires_third(
        RecountComparison(
            request.count.value, second.value, policy.absolute_tolerance, policy.relative_per_100
        )
    )
    return (
        "awaiting_third"
        if required and not RecountAttempt.objects.filter(request=request, role="third").exists()
        else "awaiting_selection"
    )


def queue_projection(request: Any) -> dict[str, Any]:  # noqa: ANN401 -- actual annotated RecountRequest projection
    return {
        "id": str(request.pk),
        "bag_id": str(request.count.bag_id),
        "bag_code": request.count.bag.code,
        "reading_id": str(request.count.receipt.reading_id),
        "state": request.qa_state,
        "expected_revision": request.qa_revision,
        "expected_result_revision": request.qa_result_revision,
    }


def next_recount_snapshot(actor: UploadActor, current: RecountRequest) -> dict[str, Any]:
    rows = (
        execution_rows(actor, {})
        .exclude(pk=current.pk)
        .exclude(first_counter=actor.user)
        .filter(qa_state__in=("awaiting_second", "awaiting_third"))
    )
    disclosures = LabNumericDisclosure.objects.filter(
        count__bag_id=OuterRef("count__bag_id"), created_by=actor.user
    )
    authored = EggCountAttempt.objects.filter(
        bag_id=OuterRef("count__bag_id"), created_by=actor.user
    )
    completed = RecountAttempt.objects.filter(request_id=OuterRef("pk"), created_by=actor.user)
    latest_second = RecountClaim.objects.filter(request_id=OuterRef("pk"), role="second").order_by(
        "-qa_revision__revision"
    )
    latest_third = RecountClaim.objects.filter(request_id=OuterRef("pk"), role="third").order_by(
        "-qa_revision__revision"
    )
    attestations = matching_cause_rows(
        RecountIndependenceAttestation.objects.filter(
            request_id=OuterRef("pk"),
            counter=actor.user,
            first_result__count_id=OuterRef("count_id"),
        ),
        "authority_proof",
    )
    rows = (
        rows.alias(
            next_disclosed=Exists(disclosures),
            next_authored=Exists(authored),
            next_completed=Exists(completed),
            next_second_counter=Subquery(latest_second.values("counter_id")[:1]),
            next_third_counter=Subquery(latest_third.values("counter_id")[:1]),
            next_second_attested=Exists(attestations.filter(role="second")),
            next_third_attested=Exists(attestations.filter(role="third")),
        )
        .filter(next_disclosed=False, next_authored=False, next_completed=False)
        .filter(
            Q(qa_state="awaiting_second")
            & (Q(next_second_counter__isnull=True) | Q(next_second_counter=actor.user.pk))
            & (Q(count__blind_boundary__isnull=False) | Q(next_second_attested=True))
            | Q(qa_state="awaiting_third", count__bag__in=scoped_bags(actor, RECOUNT_ADJUDICATE))
            & (Q(next_third_counter__isnull=True) | Q(next_third_counter=actor.user.pk))
            & (Q(count__blind_boundary__isnull=False) | Q(next_third_attested=True))
        )
        .filter(count__bag__in=scoped_bags(actor, RECOUNT_CREATE))
    )
    candidate = rows.select_related("count__bag", "count__receipt").first()
    return {
        "next_recount": None if candidate is None else queue_projection(candidate),
        "queue_context": {
            "permission": RECOUNT_CREATE,
            "ordering": "created_at,id",
            "purpose": "independent_observation",
        },
    }


def paddle_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Any]:
    """One actual binding covers every stored physical context before count/page."""
    from inventory.allocations.scope import scoped_assignments
    from inventory.transfers.scope import paired_query
    from lab.models import EggPaddle, PaddleBagBinding
    from lab.permissions import PADDLE_REUSE
    from organizations.scope import EffectiveScope
    from uploads.access import current_scope

    rows = EggPaddle.objects.filter(organization=actor.organization)
    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if PADDLE_REUSE not in codes:
            continue
        assignments = scoped_assignments(actor, PADDLE_REUSE, EffectiveScope(((codes, grant),)))
        hidden_bags = PaddleBagBinding.objects.filter(paddle_id=OuterRef("pk")).exclude(
            paired_query(
                grant,
                "bag__reading__ovitrap__sampling_point__block__quadrant__center_id",
                "bag__reading__ovitrap__sampling_point__block__quadrant_id",
            )
        )
        hidden_issues = PaddleBagBinding.objects.filter(paddle_id=OuterRef("pk")).exclude(
            issue_movement__assignment__in=assignments
        )
        hidden_returns = PaddleReuse.objects.filter(binding__paddle_id=OuterRef("pk")).exclude(
            paired_query(grant, "destination__center_id", "destination__quadrant_id")
        )
        permitted = rows.filter(
            paired_query(grant, "location__center_id", "location__quadrant_id"),
            paired_query(grant, "piece__lot__center_id", "piece__lot__quadrant_id"),
            ~Exists(hidden_bags),
            ~Exists(hidden_issues),
            ~Exists(hidden_returns),
        )
        allowed |= Q(pk__in=permitted)
    revision = PaddleBagBinding.objects.filter(paddle_id=OuterRef("pk")).order_by("-cycle")
    rows = rows.filter(allowed).annotate(
        current_cycle=Coalesce(Subquery(revision.values("cycle")[:1]), Value(0))
    )
    if "code" in values:
        rows = rows.filter(code=values["code"])
    return cast(QuerySet[Any], rows.order_by(values.get("ordering", "created_at"), "id"))
