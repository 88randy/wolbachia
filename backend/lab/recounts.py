"""Durable independent requests; this producer never executes or adjudicates a recount."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from heapq import nsmallest
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db.models import OuterRef, QuerySet, Subquery

from core.snapshots import snapshot_hash
from core.time import server_now
from lab.access import PreparedLabSubject
from lab.exceptions import LabConflictError, LabInProgressError
from lab.models import (
    DailyRecountSample,
    DailyRecountSampleMember,
    EggCountAttempt,
    LabResultRevision,
    RecountRequest,
    RecountRequestCause,
)
from lab.policies import sample_size
from lab.transactions import lab_system_transaction, require_prepared_author
from organizations.models import Organization
from reviews.effect_receipts import effective_effects


def ensure_count_requests(
    count: EggCountAttempt, causes: tuple[str, ...], proof: dict[str, Any] | None = None
) -> RecountRequest | None:
    if not causes:
        return None
    if count.created_by is None:
        raise LabConflictError("lab_source_incoherent")
    require_prepared_author(count.created_by_id)
    request, _ = RecountRequest.objects.get_or_create(
        count=count,
        defaults={
            "organization": count.organization,
            "created_by": count.created_by,
            "actor_kind": "human",
            "policy_version": "lab.qa.v1",
            "first_counter": count.created_by,
            "independent_required": True,
        },
    )
    for kind in causes:
        RecountRequestCause.objects.get_or_create(
            request=request,
            kind=kind,
            defaults={
                "organization": count.organization,
                "created_by": count.created_by,
                "actor_kind": "human",
                "policy_version": "lab.qa.v1",
                "proof": proof or {"rules": count.rules, "source": count.source_proof},
            },
        )
    return request


def carry_pending_obligations(count: EggCountAttempt) -> None:
    pending = RecountRequest.objects.filter(
        count__bag=count.bag, supersession__isnull=False, supersession__replacement__isnull=True
    ).exclude(count=count)
    identities = sorted(str(pk) for pk in pending.values_list("pk", flat=True))
    if identities:
        ensure_count_requests(
            count,
            ("carried_obligation",),
            {"predecessor_request_ids": identities, "replacement_count_id": str(count.pk)},
        )


@dataclass(frozen=True)
class ClosedDayInput:
    organization: Organization
    local_day: date


@dataclass(frozen=True)
class PopulationFrame:
    organization: Organization
    local_day: date
    utc_from: datetime
    utc_before: datetime
    rules: dict[str, Any]
    population: int
    quota: int
    fingerprint: str
    selected: frozenset[UUID]
    newly_selected: frozenset[UUID]
    prepared: tuple[PreparedLabSubject, ...]


@dataclass(frozen=True)
class SamplingOutcome:
    sample_id: UUID
    created: bool
    population: int
    quota: int


def daily_population(frame: tuple[Organization, datetime, datetime]) -> QuerySet[EggCountAttempt]:
    organization, start, before = frame
    latest = LabResultRevision.objects.filter(bag_id=OuterRef("bag_id")).order_by("-revision")
    rows = EggCountAttempt.objects.filter(
        organization=organization,
        created_at__gte=start,
        created_at__lt=before,
        pk=Subquery(latest.values("count_id")[:1]),
    )
    return effective_effects(rows, "receipt__reading__event").order_by("pk")


def population_fingerprint(
    rows: QuerySet[EggCountAttempt], metadata: dict[str, Any]
) -> tuple[str, int]:
    fingerprint = snapshot_hash(metadata)
    population = 0
    for identity, bag_id, source_hash in rows.values_list("pk", "bag_id", "source_proof").iterator(
        chunk_size=256
    ):
        fingerprint = snapshot_hash(
            {
                "previous": fingerprint,
                "count": str(identity),
                "bag": str(bag_id),
                "source": source_hash,
            }
        )
        population += 1
    return fingerprint, population


def sample_rank(organization_id: UUID, local_day: date, identifier: UUID) -> str:
    return snapshot_hash(
        {
            "organization": str(organization_id),
            "local_day": local_day.isoformat(),
            "count": str(identifier),
        }
    )


def prepare_closed_day(request: ClosedDayInput) -> PopulationFrame:
    from lab.counting import SAMPLE_RATE_KEY, capture_lab_rules

    organization = Organization.objects.get(pk=request.organization.pk, is_active=True)
    zone = ZoneInfo(organization.timezone)
    if request.local_day >= server_now().astimezone(zone).date():
        raise LabConflictError("lab_day_not_closed")
    start = datetime.combine(request.local_day, time.min, zone).astimezone(UTC)
    before = datetime.combine(request.local_day + timedelta(days=1), time.min, zone).astimezone(UTC)
    rules = {
        **capture_lab_rules(organization, before),
        "organization_revision": organization.revision,
        "timezone": organization.timezone,
        "rule_cutoff": before.isoformat(),
    }
    rows = daily_population((organization, start, before))
    fingerprint, population = population_fingerprint(rows, rules)
    quota = sample_size(population, rules[SAMPLE_RATE_KEY]["value"])
    previous = frozenset(
        DailyRecountSampleMember.objects.filter(
            sample__organization=organization,
            sample__local_day=request.local_day,
            count__in=rows,
            selected=True,
        ).values_list("count_id", flat=True)
    )
    candidates = (
        (sample_rank(organization.pk, request.local_day, identity), str(identity))
        for identity in rows.exclude(pk__in=previous)
        .values_list("pk", flat=True)
        .iterator(chunk_size=256)
    )
    selected = frozenset(
        UUID(identity) for _, identity in nsmallest(max(0, quota - len(previous)), candidates)
    )
    prepared = tuple(
        _sample_subject(count)
        for count in rows.filter(pk__in=selected).select_related(
            "receipt__reading__event", "receipt__reading__ovitrap__sampling_point__block__quadrant"
        )
    )
    return PopulationFrame(
        organization,
        request.local_day,
        start,
        before,
        rules,
        population,
        quota,
        fingerprint,
        previous | selected,
        selected,
        prepared,
    )


def _sample_subject(count: EggCountAttempt) -> PreparedLabSubject:
    reading = count.receipt.reading
    if (
        reading.event.created_by_id is None
        or count.created_by_id is None
        or count.receipt.created_by_id is None
    ):
        raise LabConflictError("lab_source_incoherent")
    quadrant = reading.ovitrap.sampling_point.block.quadrant
    return PreparedLabSubject(
        reading.pk,
        reading.event_id,
        reading.event.created_by_id,
        count.bag_id,
        quadrant.center_id,
        quadrant.pk,
        tuple(sorted({count.created_by_id, count.receipt.created_by_id})),
    )


def close_lab_day(request: ClosedDayInput) -> SamplingOutcome:
    frame = prepare_closed_day(request)
    with lab_system_transaction(frame.organization, frame.prepared) as locked:
        if (
            locked.revision != frame.organization.revision
            or locked.timezone != frame.organization.timezone
        ):
            raise LabInProgressError
        from lab.counting import capture_lab_rules

        current_rules = {
            **capture_lab_rules(locked, frame.utc_before),
            "organization_revision": locked.revision,
            "timezone": locked.timezone,
            "rule_cutoff": frame.utc_before.isoformat(),
        }
        if current_rules != frame.rules:
            raise LabInProgressError
        rows = daily_population((locked, frame.utc_from, frame.utc_before))
        fingerprint, population = population_fingerprint(rows, frame.rules)
        if fingerprint != frame.fingerprint or population != frame.population:
            raise LabInProgressError
        existing = DailyRecountSample.objects.filter(
            organization=locked, local_day=frame.local_day, frame_hash=fingerprint
        ).first()
        if existing is not None:
            return SamplingOutcome(existing.pk, False, existing.population, existing.quota)
        previous = (
            DailyRecountSample.objects.filter(organization=locked, local_day=frame.local_day)
            .order_by("-revision")
            .first()
        )
        sample = DailyRecountSample.objects.create(
            organization=locked,
            created_by=None,
            actor_kind="system",
            policy_version="lab.sample.v1",
            local_day=frame.local_day,
            revision=1 if previous is None else previous.revision + 1,
            timezone=locked.timezone,
            frame_hash=fingerprint,
            population=population,
            quota=frame.quota,
            rules=frame.rules,
            utc_from=frame.utc_from,
            utc_before=frame.utc_before,
        )
        persist_sample_members(sample, rows, frame)
        for count in rows.filter(pk__in=frame.newly_selected):
            add_sample_request(count, sample)
        return SamplingOutcome(sample.pk, True, population, frame.quota)


def persist_sample_members(
    sample: DailyRecountSample, rows: QuerySet[EggCountAttempt], frame: PopulationFrame
) -> None:
    batch = []
    for identity in rows.values_list("pk", flat=True).iterator(chunk_size=256):
        batch.append(
            DailyRecountSampleMember(
                organization=sample.organization,
                created_by=None,
                actor_kind="system",
                policy_version="lab.sample.v1",
                sample=sample,
                count_id=identity,
                rank=sample_rank(sample.organization_id, frame.local_day, identity),
                selected=identity in frame.selected,
            )
        )
        if len(batch) == 256:
            DailyRecountSampleMember.objects.bulk_create(batch)
            batch = []
    if batch:
        DailyRecountSampleMember.objects.bulk_create(batch)


def add_sample_request(count: EggCountAttempt, sample: DailyRecountSample) -> None:
    if count.created_by_id is None:
        raise LabConflictError("lab_source_incoherent")
    require_prepared_author(count.created_by_id)
    require_prepared_author(count.receipt.created_by_id)
    request, _ = RecountRequest.objects.get_or_create(
        count=count,
        defaults={
            "organization": count.organization,
            "created_by": None,
            "actor_kind": "system",
            "policy_version": "lab.sample.v1",
            "first_counter_id": count.created_by_id,
            "independent_required": True,
        },
    )
    RecountRequestCause.objects.get_or_create(
        request=request,
        kind="daily_sample",
        defaults={
            "organization": count.organization,
            "created_by": None,
            "actor_kind": "system",
            "policy_version": "lab.sample.v1",
            "proof": {
                "sample_id": str(sample.pk),
                "rules": sample.rules,
                "population": sample.population,
            },
        },
    )
    from lab.history import publish_lab_fact

    publish_lab_fact(count)
