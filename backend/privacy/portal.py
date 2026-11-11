"""Public portal aggregates (W69-W71): counts only, never personal data or exact locations."""

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncWeek

from geography.models import QuadrantVersion
from organizations.models import Organization
from ovitraps.models import OvitrapReading
from privacy.models import PortalSettings
from releases.models import Release

# A "colonia" is not modeled yet: the quadrant (code + polygon) is the public geographic unit.
# [ASSUMPTION] confirm with the client whether a neighbourhood layer is needed.
PORTAL_INDICATORS = (
    "releases_total",
    "quadrants_covered",
    "readings_total",
    "egg_positivity",
    "releases_by_week",
    "coverage",
)
SUMMARY_INDICATORS = ("releases_total", "quadrants_covered", "readings_total", "egg_positivity")


def portal_settings(organization: Organization) -> PortalSettings | None:
    row = PortalSettings.objects.filter(organization=organization).first()
    return row if row is not None and row.enabled and organization.is_active else None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _cutoff(organization: Organization) -> str | None:
    value = Release.objects.filter(organization=organization).aggregate(m=Max("device_time"))["m"]
    return _iso(value)


def releases_by_week(organization: Organization) -> dict[str, Any]:
    rows = (
        Release.objects.filter(organization=organization)
        .annotate(week=TruncWeek("device_time", tzinfo=ZoneInfo(organization.timezone)))
        .values("week", "permit_version__permit__quadrant__code")
        .annotate(releases=Count("id"), quantity=Sum("quantity"))
        .order_by("week", "permit_version__permit__quadrant__code")
    )
    return {
        "cutoff": _cutoff(organization),
        "unit": "quadrant",
        "rows": [
            {
                "week_start": row["week"].date().isoformat(),
                "area_code": row["permit_version__permit__quadrant__code"],
                "releases": row["releases"],
                "quantity": int(row["quantity"] or 0),
            }
            for row in rows
        ],
    }


def coverage(organization: Organization) -> dict[str, Any]:
    latest: dict[Any, QuadrantVersion] = {}
    versions = (
        QuadrantVersion.objects.filter(organization=organization)
        .select_related("quadrant")
        .order_by("revision")
    )
    for version in versions:
        latest[version.quadrant_id] = version
    counts = {
        row["permit_version__permit__quadrant_id"]: row["n"]
        for row in Release.objects.filter(organization=organization)
        .values("permit_version__permit__quadrant_id")
        .annotate(n=Count("id"))
    }
    return {
        "cutoff": _cutoff(organization),
        "areas": [
            {
                "area_code": version.quadrant.code,
                "geometry": version.geometry,
                "releases": counts.get(quadrant_id, 0),
            }
            for quadrant_id, version in sorted(latest.items(), key=lambda i: i[1].quadrant.code)
        ],
    }


def indicators(organization: Organization, enabled: list[str]) -> dict[str, Any]:
    releases = Release.objects.filter(organization=organization)
    readings = OvitrapReading.objects.filter(organization=organization)
    values: dict[str, Any] = {}
    if "releases_total" in enabled:
        values["releases_total"] = releases.count()
    if "quadrants_covered" in enabled:
        values["quadrants_covered"] = (
            releases.values("permit_version__permit__quadrant_id").distinct().count()
        )
    if "readings_total" in enabled:
        values["readings_total"] = readings.count()
    if "egg_positivity" in enabled:
        with_paddle = readings.filter(paddle_present=True)
        total = with_paddle.count()
        values["egg_positivity"] = (
            round(100 * with_paddle.filter(has_eggs=True).count() / total, 1) if total else None
        )
    return {"cutoff": _cutoff(organization), "values": values}
