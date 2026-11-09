"""Durable minimal B07 handoff: unavailable transport is never reported as delivery."""

from dataclasses import dataclass
from uuid import UUID

from django.db import transaction
from django.db.models import F, Max

from core.snapshots import snapshot_hash
from core.time import server_now
from organizations.models import Membership, Organization
from organizations.services import effective_scope
from people.exceptions import PeopleConflictError
from people.models import (
    Certification,
    CertificationRevocation,
    EvaluationCompletion,
    EvaluationNoticePolicyVersion,
    TrainingNoticeCause,
    TrainingNoticeIntent,
    TrainingNoticePublication,
    TrainingNoticeRoute,
)
from people.permissions import (
    EVALUATION_READ,
    TRAINING_MANAGE,
    PeopleContext,
    allows_contexts,
    require_contexts,
)
from people.policy import NOTICE_STREAK_LENGTH, StreakState, advance_streak
from people.selectors import active_completions
from uploads.access import UploadActor

NOTICE_BATCH_LIMIT = 100
UNPUBLISHED_STATUSES = frozenset(
    {"recipient_unconfigured", "recipient_unavailable", "delivery_unavailable"}
)


@dataclass(frozen=True)
class NoticeRoute:
    contexts: tuple[PeopleContext, ...]
    policy_ids: tuple[UUID, ...]
    recipient: Membership | None


@dataclass(frozen=True)
class NoticeReroute:
    actor: UploadActor
    command_id: UUID
    identifiers: tuple[UUID, ...]


def _episode(
    organization: Organization, subject_id: UUID
) -> tuple[StreakState, list[EvaluationCompletion]]:
    state = StreakState()
    episode: list[EvaluationCompletion] = []
    for completion in active_completions(organization.pk, subject_id):
        state = advance_streak(state, completion.attempt.outcome, completion.sequence)
        if completion.attempt.outcome == "pass":
            episode = []
        else:
            episode.append(completion)
    return state, episode


def _current_route(organization: Organization, contexts: tuple[PeopleContext, ...]) -> NoticeRoute:
    policies = [
        EvaluationNoticePolicyVersion.objects.filter(
            organization=organization,
            **context.lookups(),
        )
        .order_by("-revision")
        .select_related("recipient_membership")
        .first()
        for context in contexts
    ]
    ids = tuple(row.pk for row in policies if row is not None)
    if (
        len(ids) != len(contexts)
        or len({row.recipient_membership_id for row in policies if row is not None}) != 1
    ):
        return NoticeRoute(contexts, ids, None)
    policy = next(row for row in policies if row is not None)
    return NoticeRoute(contexts, ids, policy.recipient_membership)


def enqueue_notice(identifier: UUID) -> None:
    from people.tasks import publish_training_notice

    def dispatch() -> None:
        publish_training_notice.delay(str(identifier))

    transaction.on_commit(dispatch, robust=True)


def _completion_contexts(episode: list[EvaluationCompletion]) -> tuple[PeopleContext, ...]:
    return tuple(
        sorted(
            {
                PeopleContext(row.attempt.evaluation.center_id, row.attempt.evaluation.quadrant_id)
                for row in episode
            },
            key=lambda item: (str(item.center_id), str(item.quadrant_id)),
        )
    )


def _record_current_episode(organization: Organization, subject_id: UUID) -> None:
    state, episode = _episode(organization, subject_id)
    if state.count < NOTICE_STREAK_LENGTH:
        return
    trigger = next(row for row in episode if row.sequence == state.trigger_sequence)
    contexts = _completion_contexts(episode[:NOTICE_STREAK_LENGTH])
    route = _current_route(organization, contexts)
    TrainingNoticeCause.objects.get_or_create(
        organization=organization,
        subject_id=subject_id,
        episode_start=episode[0],
        kind="third_adverse",
        defaults={
            "created_by": trigger.created_by,
            "completion": trigger,
            "due_at": server_now(),
            "actor_kind": "human",
            "contexts": [context.payload() for context in contexts],
            "policy_ids": [str(value) for value in route.policy_ids],
        },
    )


def notice_contexts(cause: TrainingNoticeCause) -> tuple[PeopleContext, ...]:
    captured = tuple(
        PeopleContext(
            UUID(row["center_id"]), None if row["quadrant_id"] is None else UUID(row["quadrant_id"])
        )
        for row in cause.contexts
    )
    if cause.kind != "third_adverse":
        return captured
    _, episode = _episode(cause.organization, cause.subject_id)
    return tuple(
        sorted(
            {*captured, *_completion_contexts(episode)},
            key=lambda item: (str(item.center_id), str(item.quadrant_id)),
        )
    )


def _retained_route(cause: TrainingNoticeCause) -> NoticeRoute:
    contexts = notice_contexts(cause)
    current = (
        cause.routes.order_by("-revision").select_related("intent__recipient_membership").first()
    )
    identifiers = tuple(
        UUID(value) for value in (cause.policy_ids if current is None else current.policy_ids)
    )
    if cause.kind == "certification_expired":
        member = Membership.objects.filter(
            organization=cause.organization, user_id=cause.subject_id
        ).first()
        return NoticeRoute(contexts, (), member)
    policies = list(
        EvaluationNoticePolicyVersion.objects.filter(
            organization=cause.organization, pk__in=identifiers
        ).select_related("recipient_membership")
    )
    if (
        len(policies) != len(contexts)
        or {(row.center_id, row.quadrant_id) for row in policies}
        != {(row.center_id, row.quadrant_id) for row in contexts}
        or len({row.recipient_membership_id for row in policies}) != 1
    ):
        return NoticeRoute(contexts, identifiers, None)
    return NoticeRoute(contexts, identifiers, policies[0].recipient_membership)


def _current_cause(cause: TrainingNoticeCause) -> tuple[bool, list[str]]:
    if cause.kind == "certification_expired":
        valid = (
            cause.certification_id is not None
            and cause.due_at <= server_now()
            and not CertificationRevocation.objects.filter(
                certification_id=cause.certification_id, effective_from__lte=server_now()
            ).exists()
        )
        return valid, [str(cause.certification_id)]
    state, episode = _episode(cause.organization, cause.subject_id)
    return (
        cause.episode_start is not None
        and state.count >= NOTICE_STREAK_LENGTH
        and state.episode_start == cause.episode_start.sequence,
        [str(row.pk) for row in episode],
    )


def _recipient_available(cause: TrainingNoticeCause, route: NoticeRoute) -> bool:
    member = route.recipient
    if (
        member is None
        or not member.is_active
        or not member.user.is_active
        or not member.organization.is_active
    ):
        return False
    if cause.kind == "certification_expired":
        return member.user_id == cause.subject_id
    return allows_contexts(effective_scope(member), EVALUATION_READ, route.contexts)


def publish_notice(cause: TrainingNoticeCause) -> TrainingNoticePublication:
    """Caller has prepared Users and Organization; no broker/storage/mail I/O occurs."""
    route = _retained_route(cause)
    valid, facts = _current_cause(cause)
    status = "superseded" if not valid else "recipient_unconfigured"
    intent = None
    if valid and route.recipient is not None:
        status = "recipient_unavailable"
        if _recipient_available(cause, route):
            intent, _ = TrainingNoticeIntent.objects.get_or_create(
                organization=cause.organization,
                cause=cause,
                recipient_membership=route.recipient,
                defaults={
                    "actor_kind": "system",
                    "created_by": None,
                    "policy_ids": [str(value) for value in route.policy_ids],
                },
            )
            status = "delivery_unavailable"
    frame = {
        "status": status,
        "facts": facts,
        "policies": [str(value) for value in route.policy_ids],
        "recipient_membership_id": None if route.recipient is None else str(route.recipient.pk),
        "contexts": [context.payload() for context in route.contexts],
    }
    last = cause.publications.order_by("-attempt_number").first()
    return TrainingNoticePublication.objects.create(
        organization=cause.organization,
        cause=cause,
        frame_hash=snapshot_hash(frame),
        created_by=None,
        actor_kind="system",
        intent=intent,
        status=status,
        attempt_number=1 if last is None else last.attempt_number + 1,
        assessment=frame,
        not_published=True,
    )


def reassess_notices(organization: Organization, subject_id: UUID) -> None:
    _record_current_episode(organization, subject_id)
    for cause in TrainingNoticeCause.objects.filter(
        organization=organization, subject_id=subject_id
    ).order_by("-created_at", "pk")[:NOTICE_BATCH_LIMIT]:
        enqueue_notice(cause.pk)


def record_expiry(certificate: Certification) -> TrainingNoticeCause:
    if certificate.valid_to > server_now():
        raise PeopleConflictError("expiry_not_due")
    cause, _ = TrainingNoticeCause.objects.get_or_create(
        organization=certificate.organization,
        certification=certificate,
        defaults={
            "created_by": None,
            "actor_kind": "system",
            "subject_id": certificate.subject_id,
            "kind": "certification_expired",
            "due_at": certificate.valid_to,
            "contexts": [
                {
                    "center_id": str(certificate.center_id),
                    "quadrant_id": None
                    if certificate.quadrant_id is None
                    else str(certificate.quadrant_id),
                }
            ],
            "policy_ids": [],
        },
    )
    return cause


def reroute_pending(request: NoticeReroute, policy: EvaluationNoticePolicyVersion) -> None:
    actor = request.actor
    for identifier in sorted(request.identifiers):
        cause = TrainingNoticeCause.objects.filter(
            organization=actor.organization, pk=identifier, kind="third_adverse"
        ).first()
        if cause is None:
            from django.http import Http404

            raise Http404
        contexts = notice_contexts(cause)
        for permission in (TRAINING_MANAGE, EVALUATION_READ):
            require_contexts(actor, permission, contexts)
        if not _current_cause(cause)[0]:
            raise PeopleConflictError("notice_cause_superseded")
        last = cause.publications.order_by("-created_at", "-pk").first()
        if (
            last is None
            or last.status not in UNPUBLISHED_STATUSES
            or cause.publications.filter(not_published=False).exists()
            or cause.publications.exclude(status__in=(*UNPUBLISHED_STATUSES, "superseded")).exists()
        ):
            raise PeopleConflictError("notice_publication_not_proven_unpublished")
        route = _current_route(actor.organization, contexts)
        if (
            route.recipient is None
            or route.recipient.pk != policy.recipient_membership_id
            or policy.pk not in route.policy_ids
            or not _recipient_available(cause, route)
        ):
            raise PeopleConflictError("notice_recipient_unavailable")
        previous = cause.routes.order_by("-revision").first()
        intent, _ = TrainingNoticeIntent.objects.get_or_create(
            organization=actor.organization,
            cause=cause,
            recipient_membership=route.recipient,
            defaults={
                "created_by": actor.user,
                "actor_kind": "human",
                "policy": policy,
                "policy_ids": [str(value) for value in route.policy_ids],
            },
        )
        TrainingNoticeRoute.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            cause=cause,
            intent=intent,
            predecessor=previous,
            revision=1 if previous is None else previous.revision + 1,
            command_id=request.command_id,
            policy_ids=[str(value) for value in route.policy_ids],
        )
        enqueue_notice(cause.pk)


def notice_participants(cause: TrainingNoticeCause) -> tuple[UUID, ...]:
    route = _retained_route(cause)
    identifiers = {cause.subject_id}
    if cause.created_by_id is not None:
        identifiers.add(cause.created_by_id)
    if route.recipient is not None:
        identifiers.add(route.recipient.user_id)
    if cause.certification is not None and cause.certification.created_by_id is not None:
        identifiers.add(cause.certification.created_by_id)
    if cause.completion is not None and cause.completion.created_by_id is not None:
        identifiers.add(cause.completion.created_by_id)
    if cause.kind == "third_adverse":
        _, episode = _episode(cause.organization, cause.subject_id)
        for completion in episode:
            identifiers.update(
                identifier
                for identifier in (
                    completion.created_by_id,
                    completion.attempt.evaluation.created_by_id,
                )
                if identifier is not None
            )
    return tuple(sorted(identifiers))


def recover_notice(identifier: UUID) -> bool:
    from field_sync.exceptions import SyncInProgressError
    from people.transactions import people_system_transaction

    cause = (
        TrainingNoticeCause.objects.select_related("organization", "certification", "completion")
        .filter(pk=identifier)
        .first()
    )
    if cause is None:
        return False
    participants = notice_participants(cause)
    with people_system_transaction(cause.organization, participants):
        if not set(notice_participants(cause)).issubset(participants):
            raise SyncInProgressError
        publish_notice(cause)
    return True


def recover_expiry(identifier: UUID) -> bool:
    from people.transactions import people_system_transaction

    certificate = (
        Certification.objects.select_related("organization")
        .filter(pk=identifier, valid_to__lte=server_now())
        .first()
    )
    if certificate is None:
        return False
    participants = tuple(sorted({certificate.subject_id, certificate.created_by_id}))
    with people_system_transaction(certificate.organization, participants):
        cause = record_expiry(certificate)
        publish_notice(cause)
    return True


def recover_due_notices() -> dict[str, int]:
    due = list(
        Certification.objects.filter(valid_to__lte=server_now(), expiry_cause__isnull=True)
        .order_by("valid_to", "pk")
        .values_list("pk", flat=True)[:NOTICE_BATCH_LIMIT]
    )
    expiries = sum(recover_expiry(identifier) for identifier in due)
    # Every actual observation appends an attempt, so oldest-observed-first is fair.
    pending = list(
        TrainingNoticeCause.objects.annotate(_observed_at=Max("publications__created_at"))
        .order_by(F("_observed_at").asc(nulls_first=True), "created_at", "pk")
        .values_list("pk", flat=True)[:NOTICE_BATCH_LIMIT]
    )
    observed = sum(recover_notice(identifier) for identifier in pending)
    return {"expiries_observed": expiries, "causes_observed": observed}
