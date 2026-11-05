"""B-11: each case maps to a criterion in geography/README.md."""

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from math import degrees
from uuid import uuid4

import pytest
from django.db import connection

from core.exceptions import FieldValidationError
from geography.geometry import (
    EARTH_RADIUS_M,
    contains_point,
    distance_m,
    suggest_points,
    validate_polygon,
)


def polygon(west=-100.0, east=-99.99):
    return {
        "type": "Polygon",
        "coordinates": [[[west, 20], [east, 20], [east, 20.01], [west, 20.01], [west, 20]]],
    }


@pytest.mark.parametrize(
    "geometry",
    [
        {"type": "MultiPolygon", "coordinates": []},
        {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [0, 1], [1, 0], [0, 0]]]},
        {"type": "Polygon", "coordinates": [[[0, 0], [181, 0], [0, 1], [0, 0]]]},
        {"type": "Polygon", "coordinates": [[[0, 0], [1, float("nan")], [0, 1], [0, 0]]]},
        {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [0, 91], [0, 0]]]},
        {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [0, 1]]]},
    ],
)
def test_geometry_refuses_invalid_or_unsupported_coordinates(geometry):
    with pytest.raises(ValueError, match=".+"):
        validate_polygon(geometry)


def test_geometry_holes_boundary_and_four_review_candidates():
    geometry = polygon()
    geometry["coordinates"].append(
        [
            [-99.998, 20.002],
            [-99.992, 20.002],
            [-99.992, 20.008],
            [-99.998, 20.008],
            [-99.998, 20.002],
        ]
    )
    assert not contains_point(geometry, [-99.995, 20.005])
    assert contains_point(geometry, [-100, 20])
    points = suggest_points(geometry)
    assert len({tuple(point) for point in points}) == 4
    assert all(contains_point(geometry, point) for point in points)


def test_metric_distance_handles_dateline_and_spacing_boundary():
    offset = degrees(50 / EARTH_RADIUS_M)
    assert distance_m([0, 0], [offset, 0]) == pytest.approx(50, abs=1e-8)
    assert distance_m([179.9999, 0], [-179.9999, 0]) < 23


def geography_setup():
    from geography.models import Quadrant
    from organizations.models import Center, all_scope
    from tests.factories import MembershipFactory, ProfileFactory

    membership = MembershipFactory(scope=all_scope())
    profile = ProfileFactory(
        organization=membership.organization,
        scope=all_scope(),
        permission_codes=["quadrant.read", "quadrant.publish", "sampling_point.create"],
    )
    membership.profiles.add(profile)
    center = Center.objects.create(
        organization=membership.organization, code="C-108", name="Test center"
    )
    quadrant = Quadrant.objects.create(
        organization=membership.organization,
        center=center,
        code="Q-108",
        created_by=membership.user,
    )
    return membership, quadrant


def publish(quadrant, membership, geometry, revision=0, resolutions=()):
    from geography.services import QuadrantPublication, publish_quadrant

    return publish_quadrant(
        quadrant, QuadrantPublication(membership, revision, geometry, tuple(resolutions))
    )


def populated_geography():
    from geography.services import BlockCreation, PointCreation, create_block, create_sampling_point

    membership, quadrant = geography_setup()
    initial = publish(quadrant, membership, polygon())
    block, _block_version = create_block(quadrant, BlockCreation(membership, "B-108", polygon()))
    point, _point_version, _warnings = create_sampling_point(
        block, PointCreation(membership, "P-108", [-99.991, 20.005])
    )
    return membership, quadrant, initial, block, point


@pytest.mark.django_db
def test_outside_points_require_exhaustive_evidenced_decisions_and_keep_history():
    from geography.exceptions import UnresolvedPointsError
    from geography.models import ExcludedPointResolution, PointVersion, QuadrantVersion
    from geography.selectors import quadrant_version_at
    from geography.services import PointCreation, PointResolution, create_sampling_point

    membership, quadrant, initial, block, point = populated_geography()
    second, _point_version, _warnings = create_sampling_point(
        block, PointCreation(membership, "P-109", [-99.992, 20.005])
    )
    reduced = polygon(east=-99.995)
    with pytest.raises(UnresolvedPointsError) as blocked:
        publish(quadrant, membership, reduced, 1)
    assert {item["point"] for item in blocked.value.blocked_by} == {str(point.pk), str(second.pk)}
    decision = PointResolution(point.pk, "move", "Reviewed relocation evidence", [-99.997, 20.005])
    with pytest.raises(UnresolvedPointsError):
        publish(quadrant, membership, reduced, 1, [decision])
    assert PointVersion.objects.filter(point=point).count() == 1
    revised = publish(
        quadrant,
        membership,
        reduced,
        1,
        [decision, PointResolution(second.pk, "remove", "Reviewed retirement evidence")],
    )
    assert QuadrantVersion.objects.filter(quadrant=quadrant).count() == 2
    assert quadrant_version_at(quadrant, initial.effective_from) == initial
    assert quadrant_version_at(quadrant, revised.effective_from) == revised
    assert quadrant_version_at(quadrant, initial.effective_from - timedelta(microseconds=1)) is None
    assert PointVersion.objects.filter(point=point).latest("version").point.code == "P-108"
    assert PointVersion.objects.filter(point=second).latest("version").is_retired
    assert ExcludedPointResolution.objects.filter(quadrant_version=revised).count() == 2


@pytest.mark.django_db
def test_keep_is_explicit_and_move_must_enter_geometry():
    from geography.services import PointResolution

    membership, quadrant, _initial, _block, point = populated_geography()
    with pytest.raises(FieldValidationError):
        publish(
            quadrant,
            membership,
            polygon(east=-99.995),
            1,
            [PointResolution(point.pk, "move", "Reviewed move evidence", [-99.991, 20.005])],
        )
    revised = publish(
        quadrant,
        membership,
        polygon(east=-99.995),
        1,
        [PointResolution(point.pk, "keep", "Explicit exception evidence")],
    )
    assert revised.revision == 2


@pytest.mark.django_db(transaction=True)
def test_simultaneous_publications_create_one_successor_and_one_conflict():
    from geography.exceptions import GeographyBusyError, StaleGeographyRevisionError
    from geography.models import Quadrant, QuadrantVersion
    from organizations.models import Membership

    membership, quadrant = geography_setup()
    publish(quadrant, membership, polygon())
    barrier = threading.Barrier(2, timeout=10)
    committed = threading.Event()

    def writer(_index):
        try:
            member = Membership.objects.select_related("user", "organization").get(pk=membership.pk)
            target = Quadrant.objects.get(pk=quadrant.pk)
            barrier.wait()
            try:
                publish(target, member, polygon(east=-99.989), 1)
            except GeographyBusyError:
                assert committed.wait(10)
                publish(target, member, polygon(east=-99.989), 1)
            committed.set()
        except StaleGeographyRevisionError as error:
            return error.status_code
        else:
            return 201
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(writer, range(2))) == [201, 409]
    assert list(
        QuadrantVersion.objects.filter(quadrant=quadrant)
        .order_by("revision")
        .values_list("revision", flat=True)
    ) == [1, 2]


@pytest.mark.django_db
def test_fixed_codes_are_unique_per_organization_across_blocks():
    from geography.services import BlockCreation, PointCreation, create_block, create_sampling_point

    membership, quadrant, _initial, _block, point = populated_geography()
    second_block, _block_version = create_block(
        quadrant, BlockCreation(membership, "B-other", polygon())
    )
    with pytest.raises(FieldValidationError):
        create_sampling_point(
            second_block, PointCreation(membership, point.code, [-99.999, 20.001])
        )
    other_member, other_quadrant, _version, other_block, _other_point = populated_geography()
    independent, _point_version, _warnings = create_sampling_point(
        other_block, PointCreation(other_member, "P-shared", [-99.999, 20.001])
    )
    local, _point_version, _warnings = create_sampling_point(
        second_block, PointCreation(membership, independent.code, [-99.999, 20.001])
    )
    assert local.organization_id != independent.organization_id


@pytest.mark.django_db
def test_spacing_reads_the_current_rule_at_check_time():
    from unittest.mock import patch

    from geography.services import PointChange, PointCreation, create_sampling_point, publish_point
    from rules.models import RuleParameter, RuleParameterVersion
    from rules.seeds import seed_default_rule_parameters

    membership, _quadrant, _initial, block, _point = populated_geography()
    seed_default_rule_parameters(membership.organization)
    close = [-99.991, 20.005 + degrees(30 / EARTH_RADIUS_M)]
    other, _point_version, warnings = create_sampling_point(
        block, PointCreation(membership, "P-close", close)
    )
    assert warnings[0]["minimum_m"] == 50
    parameter = RuleParameter.objects.get(
        organization=membership.organization, key="min_distance_same_block_m"
    )
    previous = parameter.versions.latest("effective_from")
    checked_at = previous.effective_from + timedelta(days=2)
    RuleParameterVersion.objects.create(
        organization=membership.organization,
        parameter=parameter,
        value=10,
        effective_from=checked_at - timedelta(days=1),
        effective_date=(checked_at - timedelta(days=1)).date(),
        reason="Configured spacing",
    )
    with patch("geography.services.timezone.now", return_value=checked_at):
        _version, warnings = publish_point(other, PointChange(membership, 1, close))
    assert warnings == []


@pytest.mark.django_db
def test_suggestions_are_read_only_and_exclude_existing_blocks():
    from geography.models import BlockVersion, PointVersion, QuadrantVersion, SamplingPoint
    from geography.selectors import block_suggestion
    from geography.services import BlockCreation, create_block

    membership, quadrant = geography_setup()
    publish(quadrant, membership, polygon())
    counts = (
        SamplingPoint.objects.count(),
        PointVersion.objects.count(),
        QuadrantVersion.objects.count(),
        BlockVersion.objects.count(),
    )
    proposals = block_suggestion(quadrant)
    assert len(proposals) == 1
    assert proposals[0]["requires_review"] is True
    assert counts == (
        SamplingPoint.objects.count(),
        PointVersion.objects.count(),
        QuadrantVersion.objects.count(),
        BlockVersion.objects.count(),
    )
    create_block(quadrant, BlockCreation(membership, "B-occupied", polygon()))
    assert block_suggestion(quadrant) == []


@pytest.mark.django_db
def test_endpoint_default_deny_and_foreign_org_center_quadrant_isolation(api_client):
    from geography.models import Block, Quadrant, SamplingPoint
    from organizations.models import Center, all_scope, default_scope
    from tests.factories import ProfileFactory

    membership, quadrant = geography_setup()
    api_client.force_authenticate(membership.user)
    membership.profiles.clear()
    assert api_client.get("/api/v1/quadrants/").status_code == 403
    profile = ProfileFactory(
        organization=membership.organization,
        permission_codes=["quadrant.read", "quadrant.publish", "sampling_point.create"],
        scope=all_scope(),
    )
    membership.profiles.add(profile)
    membership.scope = {
        "centers": {"mode": "selected", "ids": [str(quadrant.center_id)]},
        "quadrants": {"mode": "selected", "ids": [str(quadrant.pk)]},
    }
    membership.save()
    _foreign_member, foreign = geography_setup()
    other_center = Center.objects.create(
        organization=membership.organization, code="C-hidden", name="Hidden"
    )
    hidden_center = Quadrant.objects.create(
        organization=membership.organization, center=other_center, code="Q-hidden-center"
    )
    hidden_quadrant = Quadrant.objects.create(
        organization=membership.organization, center=quadrant.center, code="Q-hidden-quadrant"
    )
    # The center test includes its quadrant UUID: only the center dimension denies it.
    membership.scope["quadrants"]["ids"].append(str(hidden_center.pk))
    membership.save()
    assert api_client.get("/api/v1/quadrants/", {"code": quadrant.code}).data["count"] == 1
    for hidden in [foreign, hidden_center, hidden_quadrant, uuid4()]:
        identifier = getattr(hidden, "pk", hidden)
        assert api_client.get(f"/api/v1/quadrants/{identifier}/").status_code == 404
        assert (
            api_client.post(
                f"/api/v1/quadrants/{identifier}/versions/",
                {"geometry": polygon(), "expected_revision": 0},
                format="json",
            ).status_code
            == 404
        )
        assert (
            api_client.get("/api/v1/blocks/suggestion/", {"quadrant": str(identifier)}).status_code
            == 404
        )
    for hidden in [foreign, hidden_center, hidden_quadrant]:
        hidden_block = Block.objects.create(
            organization=hidden.organization, quadrant=hidden, code=f"B-{hidden.code}"
        )
        hidden_point = SamplingPoint.objects.create(
            organization=hidden.organization, block=hidden_block, code=f"P-{hidden.code}"
        )
        assert api_client.get(f"/api/v1/blocks/{hidden_block.pk}/").status_code == 404
        assert api_client.get(f"/api/v1/sampling-points/{hidden_point.pk}/").status_code == 404
        assert (
            api_client.get("/api/v1/sampling-points/", {"block": str(hidden_block.pk)}).status_code
            == 404
        )
        assert (
            api_client.post(
                "/api/v1/sampling-points/",
                {"block": str(hidden_block.pk), "code": "P-denied", "location": [-99.999, 20.001]},
                format="json",
            ).status_code
            == 404
        )
        assert (
            api_client.post(
                f"/api/v1/quadrants/{quadrant.pk}/versions/",
                {
                    "expected_revision": 0,
                    "geometry": polygon(),
                    "point_resolutions": [
                        {
                            "point": str(hidden_point.pk),
                            "decision": "remove",
                            "evidence": "Reviewed evidence",
                        }
                    ],
                },
                format="json",
            ).status_code
            == 404
        )
    membership.scope = default_scope()
    membership.save()
    assert api_client.get("/api/v1/quadrants/").data["count"] == 0


def test_exported_geography_contract_matches_live_schema():
    from pathlib import Path

    import yaml
    from django.conf import settings
    from drf_spectacular.generators import SchemaGenerator

    exported = yaml.safe_load(
        (Path(settings.BASE_DIR).parent / "packages/api-client/openapi.yaml").read_text(
            encoding="utf-8"
        )
    )
    live = SchemaGenerator(urlconf="config.urls").get_schema(public=True)
    paths = {
        path
        for path in live["paths"]
        if path.startswith(("/api/v1/quadrants/", "/api/v1/blocks/", "/api/v1/sampling-points/"))
    }
    assert len(paths) == 10
    for path in paths:
        assert exported["paths"][path] == live["paths"][path]
    for component in [
        "QuadrantPublicationRequest",
        "QuadrantVersion",
        "BlockVersion",
        "PointVersion",
        "PointWrite",
        "BlockSuggestion",
    ]:
        assert (
            exported["components"]["schemas"][component] == live["components"]["schemas"][component]
        )


@pytest.mark.django_db
@pytest.mark.parametrize("minimum", [10, 50, 200])
def test_spacing_checks_just_below_equal_and_above_each_configured_boundary(minimum):
    from geography.services import PointCreation, create_sampling_point, spacing_warnings
    from rules.models import RuleParameter, RuleParameterVersion, Unit, ValueType

    membership, quadrant, initial, block, _point = populated_geography()
    reference, _point_version, _warnings = create_sampling_point(
        block, PointCreation(membership, "P-boundary", [-99.999, 20.001])
    )
    parameter = RuleParameter.objects.create(
        organization=membership.organization,
        key="min_distance_same_block_m",
        value_type=ValueType.INTEGER,
        unit=Unit.METERS,
        min_value=10,
        max_value=200,
    )
    RuleParameterVersion.objects.create(
        organization=membership.organization,
        parameter=parameter,
        value=minimum,
        effective_from=initial.effective_from,
        effective_date=initial.effective_from.date(),
        reason="Test spacing bounds",
    )
    for distance, is_warning in [
        (minimum - 0.001, True),
        (minimum, False),
        (minimum + 0.001, False),
    ]:
        location = [-99.999, 20.001 + degrees(distance / EARTH_RADIUS_M)]
        warnings = spacing_warnings(block, location)
        assert any(warning["point"] == str(reference.pk) for warning in warnings) is is_warning


@pytest.mark.django_db
@pytest.mark.parametrize("invalid_case", ["blank_evidence", "duplicate", "unrelated"])
def test_invalid_resolution_decisions_leave_publication_untouched(invalid_case):
    from geography.models import QuadrantVersion
    from geography.services import PointCreation, PointResolution, create_sampling_point

    membership, quadrant, _initial, block, point = populated_geography()
    decision = PointResolution(point.pk, "keep", "Reviewed exclusion evidence")
    resolutions = [decision]
    if invalid_case == "blank_evidence":
        resolutions = [PointResolution(point.pk, "keep", "   ")]
    elif invalid_case == "duplicate":
        resolutions.append(decision)
    else:
        inside, _point_version, _warnings = create_sampling_point(
            block, PointCreation(membership, "P-inside", [-99.999, 20.001])
        )
        resolutions.append(PointResolution(inside.pk, "keep", "Unrelated point evidence"))
    with pytest.raises(FieldValidationError):
        publish(quadrant, membership, polygon(east=-99.995), 1, resolutions)
    assert QuadrantVersion.objects.filter(quadrant=quadrant).count() == 1


def test_point_publish_response_retains_its_version_and_warnings_after_interleaving(monkeypatch):
    from datetime import UTC, datetime
    from types import SimpleNamespace

    from geography.models import PointVersion, SamplingPoint
    from geography.views import SamplingPointViewSet

    instant = datetime(2026, 11, 5, tzinfo=UTC)
    point = SamplingPoint(
        organization_id=uuid4(), block_id=uuid4(), code="P-race", created_at=instant
    )
    versions = [
        PointVersion(
            point=point,
            organization_id=point.organization_id,
            version=1,
            location=[-99.999, 20.001],
            effective_from=instant,
            created_at=instant,
        )
    ]
    monkeypatch.setattr(
        SamplingPoint,
        "versions",
        SimpleNamespace(order_by=lambda *fields: SimpleNamespace(first=lambda: versions[-1])),
    )
    own_warnings = [
        {"code": "spacing_below_minimum", "point": uuid4(), "distance_m": 30, "minimum_m": 50}
    ]

    def publish_then_interleave(target, change):
        own = PointVersion(
            point=target,
            organization_id=target.organization_id,
            version=2,
            location=change.location,
            effective_from=instant,
            created_at=instant,
        )
        versions.append(own)
        # Simulate a second writer after the first transaction, before serialization.
        # The latest relation now resolves version 3.
        versions.append(
            PointVersion(
                point=target,
                organization_id=target.organization_id,
                version=3,
                location=[-99.997, 20.003],
                effective_from=instant,
                created_at=instant,
            )
        )
        return own, own_warnings

    monkeypatch.setattr("geography.views.publish_point", publish_then_interleave)
    view = SamplingPointViewSet()
    view.request = SimpleNamespace(membership=object())
    monkeypatch.setattr(view, "get_object", lambda: point)
    response = view.publish_version(
        SimpleNamespace(data={"expected_revision": 1, "location": [-99.998, 20.002]})
    )

    assert response.data["point"]["current_version"]["version"] == 2
    assert response.data["point"]["current_version"]["location"] == [-99.998, 20.002]
    assert response.data["spacing_warnings"][0]["distance_m"] == 30
    assert versions[-1].version == 3


@pytest.mark.parametrize("resource", ["quadrant", "block", "point"])
def test_create_response_retains_initial_version_after_interleaving(monkeypatch, resource):
    from datetime import UTC, datetime
    from types import SimpleNamespace

    from geography.models import (
        Block,
        BlockVersion,
        PointVersion,
        Quadrant,
        QuadrantVersion,
        SamplingPoint,
    )
    from geography.serializers import GeographyRelatedField
    from geography.views import BlockViewSet, QuadrantViewSet, SamplingPointViewSet
    from organizations.models import Center

    instant = datetime(2026, 11, 5, tzinfo=UTC)
    organization_id = uuid4()
    center = Center(organization_id=organization_id, code="C-race")
    quadrant = Quadrant(
        organization_id=organization_id, center=center, code="Q-race", created_at=instant
    )
    block = Block(
        organization_id=organization_id, quadrant=quadrant, code="B-race", created_at=instant
    )
    point = SamplingPoint(
        organization_id=organization_id, block=block, code="P-race", created_at=instant
    )
    identity, parent, version_class, view_class = {
        "quadrant": (quadrant, center, QuadrantVersion, QuadrantViewSet),
        "block": (block, quadrant, BlockVersion, BlockViewSet),
        "point": (point, block, PointVersion, SamplingPointViewSet),
    }[resource]
    location_or_geometry = "location" if resource == "point" else "geometry"
    counter = "version" if resource == "point" else "revision"
    own_geometry = [-99.998, 20.002] if resource == "point" else polygon()
    later_geometry = [-99.997, 20.003] if resource == "point" else polygon(east=-99.989)
    own = version_class(
        organization_id=organization_id,
        effective_from=instant,
        created_at=instant,
        **{resource: identity, counter: 1, location_or_geometry: own_geometry},
    )
    newer = version_class(
        organization_id=organization_id,
        effective_from=instant,
        created_at=instant,
        **{resource: identity, counter: 2, location_or_geometry: later_geometry},
    )
    latest = [own]
    monkeypatch.setattr(
        type(identity),
        "versions",
        SimpleNamespace(order_by=lambda *fields: SimpleNamespace(first=lambda: latest[-1])),
    )
    monkeypatch.setattr(QuadrantVersion, "point_resolutions", [])
    monkeypatch.setattr(
        GeographyRelatedField, "to_internal_value", lambda field, identifier: parent
    )

    def create_then_interleave(_parent, _change):
        latest.append(newer)
        return (identity, own, []) if resource == "point" else (identity, own)

    service_name = "create_sampling_point" if resource == "point" else f"create_{resource}"
    monkeypatch.setattr(f"geography.views.{service_name}", create_then_interleave)
    parent_field = {"quadrant": "center", "block": "quadrant", "point": "block"}[resource]
    request = SimpleNamespace(
        data={
            parent_field: str(parent.pk),
            "code": identity.code,
            location_or_geometry: own_geometry,
        },
        membership=object(),
        query_params={},
    )
    view = view_class()
    view.request = request
    view.format_kwarg = None
    response = view.create(request)

    projection = response.data["point"] if resource == "point" else response.data
    assert projection["current_version"]["id"] == str(own.pk)
    assert projection["current_version"][location_or_geometry] == own_geometry
    assert getattr(latest[-1], counter) == 2


@pytest.mark.django_db(transaction=True)
def test_point_publish_http_response_stays_on_its_commit_after_another_publication(
    api_client, monkeypatch
):
    from geography.services import PointChange, PointCreation, create_sampling_point, publish_point

    member, _quadrant, _initial, block, point = populated_geography()
    neighbor, _neighbor_version, _warnings = create_sampling_point(
        block, PointCreation(member, "P-neighbor", [-99.991, 20.005 + degrees(30 / EARTH_RADIUS_M)])
    )
    own_location = [-99.991, 20.005 + degrees(20 / EARTH_RADIUS_M)]
    later_location = [-99.997, 20.005]
    publications = []

    def publish_then_interleave(target, change):
        own = publish_point(target, change)
        # Real commits are necessary: the newer writer runs after the first releases its locks.
        assert not connection.in_atomic_block
        publications.append(own)
        publications.append(
            publish_point(target, PointChange(member, own[0].version, later_location))
        )
        return own

    monkeypatch.setattr("geography.views.publish_point", publish_then_interleave)
    api_client.force_authenticate(member.user)
    response = api_client.post(
        f"/api/v1/sampling-points/{point.pk}/versions/",
        {"expected_revision": 1, "location": own_location},
        format="json",
    )

    own, newer = publications
    assert response.status_code == 201
    assert response.data["point"]["current_version"]["id"] == str(own[0].pk)
    assert response.data["point"]["current_version"]["location"] == own_location
    assert response.data["spacing_warnings"] == own[1]
    assert own[1][0]["point"] == str(neighbor.pk)
    assert newer[1] == []
    assert point.versions.latest("version").pk == newer[0].pk
