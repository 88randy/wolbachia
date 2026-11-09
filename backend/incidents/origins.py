"""One creation-cause annotation for reported rows, filters and scoped counts."""

from typing import Any, cast

from django.db.models import Case, CharField, Exists, F, OuterRef, Q, QuerySet, Value, When
from django.db.models.functions import Cast, JSONArray, JSONObject

from incidents.models import AutomaticIncidentOrigin, IncidentEvent
from inventory.models import ConditionIncidentLink
from lab.models import ReceptionIncidentLink
from reviews.models import ReviewIncidentLink, ReviewSubjectScope

CREATION_ORIGINS = (
    "field_event",
    "direct_report",
    "review_decision",
    "inventory_condition",
    "lab_reception",
    "unknown",
)


def _initial_reports(query: QuerySet[Any]) -> QuerySet[Any]:
    return cast(
        QuerySet[Any],
        query.annotate(
            _human_report=Exists(
                IncidentEvent.objects.filter(
                    incident_id=OuterRef("pk"),
                    organization_id=OuterRef("organization_id"),
                    revision=1,
                    action="report",
                    state="open",
                    actor_kind="human",
                    created_by_id=OuterRef("created_by_id"),
                )
            ),
            _system_report=Exists(
                IncidentEvent.objects.filter(
                    incident_id=OuterRef("pk"),
                    organization_id=OuterRef("organization_id"),
                    revision=1,
                    action="report",
                    state="open",
                    actor_kind="system",
                    created_by__isnull=True,
                )
            ),
            _has_review=Exists(ReviewIncidentLink.objects.filter(incident_id=OuterRef("pk"))),
            _has_automatic=Exists(
                AutomaticIncidentOrigin.objects.filter(incident_id=OuterRef("pk"))
            ),
            _has_condition=Exists(ConditionIncidentLink.objects.filter(incident_id=OuterRef("pk"))),
            _has_lab=Exists(ReceptionIncidentLink.objects.filter(incident_id=OuterRef("pk"))),
        ),
    )


def _retained_context() -> JSONArray:
    return JSONArray(
        JSONObject(
            center_id=Cast(OuterRef("center_id"), CharField()),
            quadrant_id=Cast(OuterRef("quadrant_id"), CharField()),
        )
    )


def _source_witness() -> Exists:
    """The original ingestion observation, never a later point/motorcycle placement.

    Both current registered incident adapters retain this exact resolved vector.
    Legacy/unresolved captures without that proof stay explicitly unknown.
    """
    return Exists(
        ReviewSubjectScope.objects.filter(
            source_event_id=OuterRef("source_event_id"),
            organization_id=OuterRef("organization_id"),
            created_by_id=OuterRef("created_by_id"),
            revision=1,
            is_resolved=True,
            proof__kind="ingestion_subject",
            contexts=_retained_context(),
        )
    )


def _review_witness() -> Exists:
    return Exists(
        ReviewIncidentLink.objects.filter(
            incident_id=OuterRef("pk"),
            organization_id=OuterRef("organization_id"),
            created_by_id=OuterRef("created_by_id"),
            review_item__organization_id=OuterRef("organization_id"),
            review_item__field_event__organization_id=OuterRef("organization_id"),
            decision__organization_id=OuterRef("organization_id"),
            decision__review_item_id=F("review_item_id"),
            decision__created_by_id=OuterRef("created_by_id"),
            decision__kind="open_incident",
            decision__is_terminal=False,
            decision__evaluation__scope_resolved=True,
            decision__evaluation__subjects=_retained_context(),
            decision__reason=OuterRef("description"),
        )
    )


def _inventory_witness() -> Exists:
    reading = "breach__reading__"
    rows = (
        ConditionIncidentLink.objects.filter(
            incident_id=OuterRef("pk"),
            organization_id=OuterRef("organization_id"),
            breach__organization_id=OuterRef("organization_id"),
            breach__reading__organization_id=OuterRef("organization_id"),
            breach__reading_id=OuterRef("automatic_origin__source_id"),
            breach__reading__evaluation="breach",
        )
        .annotate(
            _center=Case(
                When(
                    breach__reading__capture_mode="explicit_location",
                    then=F(reading + "capture_location__center_id"),
                ),
                When(
                    breach__reading__location_version__isnull=False,
                    then=F(reading + "location_version__location__center_id"),
                ),
                default=F(reading + "lot__center_id"),
            ),
            _quadrant=Case(
                When(
                    breach__reading__capture_mode="explicit_location",
                    then=F(reading + "capture_location__quadrant_id"),
                ),
                When(
                    breach__reading__location_version__isnull=False,
                    then=F(reading + "location_version__location__quadrant_id"),
                ),
                default=F(reading + "lot__quadrant_id"),
            ),
        )
        .filter(_center=OuterRef("center_id"))
    )
    return Exists(
        rows.filter(
            Q(_quadrant=OuterRef("quadrant_id"))
            | Q(_quadrant__isnull=True, incident__quadrant__isnull=True)
        )
    )


def _lab_witness() -> Exists:
    point = "discrepancy__bag__reading__ovitrap__sampling_point__block__quadrant"
    return Exists(
        ReceptionIncidentLink.objects.filter(
            incident_id=OuterRef("pk"),
            organization_id=OuterRef("organization_id"),
            actor_kind="system",
            created_by__isnull=True,
            policy_version="lab.reception.v1",
            discrepancy_id=OuterRef("automatic_origin__source_id"),
            discrepancy__organization_id=OuterRef("organization_id"),
            discrepancy__source__organization_id=OuterRef("organization_id"),
            discrepancy__bag__organization_id=OuterRef("organization_id"),
            policy__organization_id=OuterRef("organization_id"),
        )
        .filter(
            **{point + "__center_id": OuterRef("center_id"), point + "_id": OuterRef("quadrant_id")}
        )
        .filter(
            Q(
                discrepancy__kind="missing",
                policy__missing_type_version_id=OuterRef("type_version_id"),
            )
            | Q(
                discrepancy__kind="no_reading",
                policy__no_reading_type_version_id=OuterRef("type_version_id"),
            )
        )
    )


def annotate_creation_origin(query: QuerySet[Any]) -> QuerySet[Any]:
    """Independent proof presence vetoes another cause even when that proof is incoherent."""
    query = _initial_reports(query).annotate(
        _review_witness=_review_witness(),
        _inventory_witness=_inventory_witness(),
        _lab_witness=_lab_witness(),
        _source_witness=_source_witness(),
    )
    human = Q(_human_report=True, created_by__isnull=False, _has_condition=False, _has_lab=False)
    system = Q(
        _system_report=True,
        created_by__isnull=True,
        source_event__isnull=True,
        _has_review=False,
        automatic_origin__organization_id=F("organization_id"),
        automatic_origin__actor_kind="system",
        automatic_origin__created_by__isnull=True,
    )
    return cast(
        QuerySet[Any],
        query.annotate(
            creation_origin=Case(
                When(
                    human
                    & Q(
                        source_event__isnull=False,
                        _has_review=False,
                        _has_automatic=False,
                        _source_witness=True,
                        source_event__organization_id=F("organization_id"),
                        source_event__created_by_id=F("created_by_id"),
                        source_event__type__in=["incident.report", "emergency.accident"],
                        source_event__device_time=F("device_time"),
                        source_event__server_received_at=F("server_received_at"),
                    ),
                    then=Value("field_event"),
                ),
                When(
                    human
                    & Q(
                        source_event__isnull=True,
                        _has_review=True,
                        _has_automatic=False,
                        _review_witness=True,
                    ),
                    then=Value("review_decision"),
                ),
                When(
                    system
                    & Q(
                        automatic_origin__source_kind="inventory_condition",
                        automatic_origin__policy_version="inventory.v1",
                        _inventory_witness=True,
                        _has_lab=False,
                    ),
                    then=Value("inventory_condition"),
                ),
                When(
                    system
                    & Q(
                        automatic_origin__source_kind="lab_reception",
                        automatic_origin__policy_version="lab.reception.v1",
                        _lab_witness=True,
                        _has_condition=False,
                    ),
                    then=Value("lab_reception"),
                ),
                When(
                    human & Q(source_event__isnull=True, _has_review=False, _has_automatic=False),
                    then=Value("direct_report"),
                ),
                default=Value("unknown"),
                output_field=CharField(),
            )
        ),
    )
