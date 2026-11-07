"""Bounded durable recovery; callbacks and continuation run outside domain transactions."""

from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from celery import shared_task
from django.db.models import Exists, OuterRef, Q

from core.time import server_now
from lab.exceptions import LabInProgressError
from lab.incidents import recover_reception_incident
from lab.models import EggCountAttempt, ReceptionDiscrepancy
from lab.recounts import ClosedDayInput, close_lab_day
from organizations.models import Organization

RECOVERY_PAGE_SIZE = 100


@shared_task  # type: ignore[untyped-decorator]  # Celery has no bundled task decorator stubs.
def recover_reception_incidents(after_time: str | None = None, after_id: str | None = None) -> int:
    rows = ReceptionDiscrepancy.objects.filter(
        incident_link__isnull=True, organization__is_active=True
    ).select_related(
        "organization",
        "bag__reading__event",
        "bag__reading__ovitrap__sampling_point__block__quadrant",
    )
    if after_time and after_id:
        at, identifier = datetime.fromisoformat(after_time), UUID(after_id)
        rows = rows.filter(Q(created_at__gt=at) | Q(created_at=at, pk__gt=identifier))
    page = list(rows.order_by("created_at", "id")[: RECOVERY_PAGE_SIZE + 1])
    linked = 0
    for discrepancy in page[:RECOVERY_PAGE_SIZE]:
        try:
            linked += recover_reception_incident(discrepancy)
        except LabInProgressError:
            continue
    if len(page) > RECOVERY_PAGE_SIZE:
        last = page[RECOVERY_PAGE_SIZE - 1]
        recover_reception_incidents.delay(last.created_at.isoformat(), str(last.pk))
    return linked


@shared_task  # type: ignore[untyped-decorator]  # Celery has no bundled task decorator stubs.
def close_due_lab_days(after_organization: str | None = None) -> int:
    actual_counts = EggCountAttempt.objects.filter(organization_id=OuterRef("pk"))
    organizations = Organization.objects.filter(is_active=True).filter(Exists(actual_counts))
    if after_organization:
        organizations = organizations.filter(pk__gt=UUID(after_organization))
    page = list(organizations.order_by("pk")[: RECOVERY_PAGE_SIZE + 1])
    for organization in page[:RECOVERY_PAGE_SIZE]:
        close_organization_days.delay(str(organization.pk))
    if len(page) > RECOVERY_PAGE_SIZE:
        close_due_lab_days.delay(str(page[RECOVERY_PAGE_SIZE - 1].pk))
    return min(len(page), RECOVERY_PAGE_SIZE)


@shared_task  # type: ignore[untyped-decorator]  # Celery's decorator has no stubs.
def close_organization_days(organization_id: str, after_day: str | None = None) -> int:
    """Revisit actual counted days so corrections and lost callbacks can supplement a draw."""
    organization = Organization.objects.filter(pk=UUID(organization_id), is_active=True).first()
    if organization is None:
        return 0
    zone = ZoneInfo(organization.timezone)
    today = server_now().astimezone(zone).date()
    # Distinct real local dates are derived server-side, never a guessed starting epoch.
    from django.db.models.functions import TruncDate

    dates = (
        EggCountAttempt.objects.filter(organization=organization, created_at__lt=server_now())
        .annotate(local_date=TruncDate("created_at", tzinfo=zone))
        .filter(local_date__lt=today)
    )
    if after_day:
        dates = dates.filter(local_date__gt=date.fromisoformat(after_day))
    page = list(
        dates.values_list("local_date", flat=True)
        .distinct()
        .order_by("local_date")[: RECOVERY_PAGE_SIZE + 1]
    )
    created = 0
    for local_day in page[:RECOVERY_PAGE_SIZE]:
        try:
            created += close_lab_day(ClosedDayInput(organization, local_day)).created
        except LabInProgressError:
            continue
    if len(page) > RECOVERY_PAGE_SIZE:
        close_organization_days.delay(organization_id, page[RECOVERY_PAGE_SIZE - 1].isoformat())
    return created
