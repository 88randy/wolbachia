"""Issue #224: documented server table queries, before pagination and within scope."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import pytest
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from catalogs.models import CatalogItem
from catalogs.serializers import CatalogItemFilterSerializer
from core.table_filters import TableOrderingFilter, TableSearchFilter
from geography.history import PointHistoryQuerySerializer, RevisionHistoryQuerySerializer
from organizations.models import all_scope
from rules.models import Unit, ValueType
from rules.serializers import ParameterFilterSerializer, VersionFilterSerializer
from tests.factories import (
    CatalogFactory,
    CatalogItemFactory,
    DeviceFactory,
    MembershipFactory,
    RuleParameterFactory,
    RuleParameterVersionFactory,
    ShiftFactory,
    UserFactory,
)


@pytest.mark.parametrize("ordering", ["missing", "label_es,missing", "", "--sort", "sort,"])
def test_table_ordering_rejects_unsupported_or_empty_terms(ordering):
    request = Request(APIRequestFactory().get("/", {"ordering": ordering}))
    view = SimpleNamespace(ordering_fields=["label_es", "sort"], ordering=["sort"])

    with pytest.raises(ValidationError) as error:
        TableOrderingFilter().get_ordering(request, CatalogItem.objects.none(), view)

    assert "ordering" in error.value.detail


@pytest.mark.parametrize(
    ("serializer", "query", "field"),
    [
        (CatalogItemFilterSerializer, {"is_active": "1"}, "is_active"),
        (CatalogItemFilterSerializer, {"is_active": ""}, "is_active"),
        (ParameterFilterSerializer, {"unit": "invented"}, "unit"),
        (ParameterFilterSerializer, {"value_type": "string"}, "value_type"),
        (VersionFilterSerializer, {"status": "active"}, "status"),
        (PointHistoryQuerySerializer, {"is_retired": "yes"}, "is_retired"),
        (RevisionHistoryQuerySerializer, {"revision": "0"}, "revision"),
        (RevisionHistoryQuerySerializer, {"ordering": "code"}, "ordering"),
        (PointHistoryQuerySerializer, {"created_by": "bad"}, "created_by"),
        (PointHistoryQuerySerializer, {"effective_from_from": "bad"}, "effective_from_from"),
        (
            PointHistoryQuerySerializer,
            {
                "effective_from_from": "2026-01-02T00:00Z",
                "effective_from_before": "2026-01-01T00:00Z",
            },
            "effective_from_before",
        ),
    ],
)
def test_table_facets_reject_invalid_query_values(serializer, query, field):
    payload = serializer(data=query)
    assert not payload.is_valid()
    assert field in payload.errors


def test_search_rejects_nul_as_a_named_query_field():
    request = Request(APIRequestFactory().get("/", {"search": "bad\x00term"}))
    view = SimpleNamespace(action="list", search_fields=["code"])
    with pytest.raises(ValidationError) as error:
        TableSearchFilter().filter_queryset(request, CatalogItem.objects.none(), view)
    assert "search" in error.value.detail


@pytest.mark.parametrize(
    "view_path", ["catalogs.views.CatalogItemViewSet", "accounts.views.DeviceViewSet"]
)
def test_schema_querysets_do_not_need_a_request_or_database(view_path):
    from django.utils.module_loading import import_string

    view = import_string(view_path)()
    view.swagger_fake_view = True
    assert not view.get_queryset().exists()


@pytest.fixture
def table_admin(api_client, org_a, make_member):
    codes = [
        "catalog.read",
        "catalog_item.update",
        "rule_parameter.read",
        "rule_parameter_version.read",
        "device.read",
        "quadrant.read",
    ]
    user, membership = make_member(org_a, codes)
    membership.scope = all_scope()
    membership.save(update_fields=["scope"])
    profile = membership.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    api_client.force_authenticate(user)
    return api_client


def paged_rows(client, path, query):
    rows = []
    page = 1
    while True:
        response = client.get(path, {**query, "page_size": 1, "page": page})
        assert response.status_code == 200, response.data
        rows.extend(response.data["results"])
        if response.data["next"] is None:
            assert len(rows) == response.data["count"]
            return rows
        page += 1


@pytest.mark.django_db
def test_parameter_queries_filter_and_sort_current_projection_before_paging(
    table_admin, org_a, org_b, monkeypatch
):
    instant = datetime(2026, 1, 10, tzinfo=UTC)
    monkeypatch.setattr("rules.views.timezone.now", lambda: instant)
    for key, unit, kind, days in [
        ("zeta", Unit.METERS, ValueType.INTEGER, 3),
        ("alpha", Unit.COUNT, ValueType.INTEGER, 1),
        ("beta", Unit.METERS, ValueType.DECIMAL, 2),
    ]:
        parameter = RuleParameterFactory(organization=org_a, key=key, unit=unit, value_type=kind)
        RuleParameterVersionFactory(
            parameter=parameter, effective_from=instant - timedelta(days=days)
        )
    RuleParameterFactory(organization=org_b, key="zeta", unit=Unit.METERS)
    path = "/api/v1/rule-parameters/"

    assert [row["key"] for row in paged_rows(table_admin, path, {})] == ["alpha", "beta", "zeta"]
    assert [row["key"] for row in paged_rows(table_admin, path, {"search": "zeta"})] == ["zeta"]
    assert [
        row["key"] for row in paged_rows(table_admin, path, {"unit": "m", "value_type": "integer"})
    ] == ["zeta"]
    assert [
        row["key"] for row in paged_rows(table_admin, path, {"ordering": "effective_from"})
    ] == ["zeta", "beta", "alpha"]
    assert [
        row["key"] for row in paged_rows(table_admin, path, {"ordering": "-effective_from"})
    ] == ["alpha", "beta", "zeta"]


@pytest.mark.django_db
def test_rule_history_search_status_and_value_order_preserve_void_visibility(
    table_admin, org_a, org_b, monkeypatch
):
    instant = datetime(2026, 1, 10, tzinfo=UTC)
    monkeypatch.setattr("rules.views.timezone.now", lambda: instant)
    parameter = RuleParameterFactory(organization=org_a, key="threshold")
    old = RuleParameterVersionFactory(
        parameter=parameter, value=10, effective_from=instant - timedelta(days=2), reason="retained"
    )
    current = RuleParameterVersionFactory(
        parameter=parameter, value=20, effective_from=instant - timedelta(days=1), reason="current"
    )
    scheduled = RuleParameterVersionFactory(
        parameter=parameter, value=30, effective_from=instant + timedelta(days=1), reason="planned"
    )
    voided = RuleParameterVersionFactory(
        parameter=parameter,
        value=40,
        effective_from=instant + timedelta(days=2),
        voided_at=instant,
        voided_by=UserFactory(),
        void_reason="Voided future configuration",
        void_reason_code="other",
    )
    RuleParameterVersionFactory(
        parameter=RuleParameterFactory(organization=org_b, key=parameter.key),
        value=99,
        reason="planned",
    )
    path = "/api/v1/rule-parameters/threshold/versions/"

    assert [row["value"] for row in paged_rows(table_admin, path, {"ordering": "value"})] == [
        10,
        20,
        30,
    ]
    assert [
        row["id"]
        for row in paged_rows(table_admin, path, {"search": "planned", "status": "scheduled"})
    ] == [str(scheduled.pk)]
    assert [row["id"] for row in paged_rows(table_admin, path, {"status": "voided"})] == []
    assert [
        row["id"]
        for row in paged_rows(table_admin, path, {"status": "voided", "include_voided": "true"})
    ] == [str(voided.pk)]
    assert [row["id"] for row in paged_rows(table_admin, path, {})] == [
        str(scheduled.pk),
        str(current.pk),
        str(old.pk),
    ]


@pytest.mark.django_db
def test_catalog_search_and_labels_sort_before_paging(table_admin, org_a, org_b):
    for slug in ["zeta", "alpha", "beta"]:
        CatalogFactory(organization=org_a, slug=slug, label_es=f"ES {slug}", label_en=f"EN {slug}")
    CatalogFactory(organization=org_b, slug="zeta", label_es="ES zeta")
    path = "/api/v1/catalogs/"
    for term in ["zeta", '"ES zeta"', '"EN zeta"']:
        assert [row["slug"] for row in paged_rows(table_admin, path, {"search": term})] == ["zeta"]
    assert [row["slug"] for row in paged_rows(table_admin, path, {"ordering": "-label_es"})] == [
        "zeta",
        "beta",
        "alpha",
    ]
    assert paged_rows(table_admin, path, {"search": "absent"}) == []
    invalid = table_admin.get(path, {"ordering": "label_es,unsupported"})
    assert invalid.status_code == 400
    assert invalid.data["code"] == "validation_error"
    assert "ordering" in invalid.data["fields"]


@pytest.mark.django_db
def test_item_filters_order_with_other_last_and_do_not_reduce_reorder_set(
    table_admin, org_a, org_b
):
    from shifts.models import MotorcycleCheck

    catalog = CatalogFactory(organization=org_a)
    first = CatalogItemFactory(catalog=catalog, code="alpha", sort=5, id=UUID(int=2))
    later = CatalogItemFactory(
        catalog=catalog,
        code="zeta",
        sort=5,
        id=UUID(int=1),
        label_es="match Spanish",
        label_en="match English",
    )
    inactive = CatalogItemFactory(catalog=catalog, code="off", is_active=False, sort=10)
    other = CatalogItemFactory(catalog=catalog, code="other", is_other=True, sort=100)
    CatalogItemFactory(
        catalog=CatalogFactory(organization=org_b, slug=catalog.slug), code=later.code
    )
    MotorcycleCheck.objects.create(
        organization=org_a, shift=ShiftFactory(organization=org_a), item=first, result="ok"
    )
    path = f"/api/v1/catalogs/{catalog.slug}/items/"

    for term in ["zeta", '"match Spanish"', '"match English"']:
        assert [row["id"] for row in paged_rows(table_admin, path, {"search": term})] == [
            str(later.pk)
        ]
    assert [row["id"] for row in paged_rows(table_admin, path, {"is_active": "false"})] == [
        str(inactive.pk)
    ]
    assert [
        row["id"]
        for row in paged_rows(table_admin, path, {"is_active": "true", "ordering": "-sort"})
    ] == [str(later.pk), str(first.pk), str(other.pk)]
    assert [row["id"] for row in paged_rows(table_admin, path, {"ordering": "-usage_count"})][
        0
    ] == str(first.pk)
    response = table_admin.post(
        f"{path}reorder/?search=zeta&is_active=true",
        {"version": 0, "ordered_ids": [str(later.pk)]},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["fields"]["ordered_ids"][0]["code"] == "reorder_ids_mismatch"
    catalog.refresh_from_db()
    assert catalog.revision == 0
    invalid = table_admin.get(path, {"is_active": "yes"})
    assert invalid.status_code == 400
    assert "is_active" in invalid.data["fields"]


@pytest.mark.django_db
def test_device_search_keeps_users_and_devices_in_organization_before_paging(
    table_admin, org_a, org_b
):
    member = MembershipFactory(organization=org_a, user__username="matched-user")
    foreign = MembershipFactory(organization=org_b, user__username="foreign-only")
    DeviceFactory(organization=org_a, label="first", id=UUID(int=2))
    found = DeviceFactory(
        organization=org_a,
        label="zeta",
        serial="serial-match",
        app_version="version-match",
        last_user=member.user,
        id=UUID(int=1),
    )
    DeviceFactory(
        organization=org_b,
        label=found.label,
        serial=found.serial,
        app_version=found.app_version,
        last_user=foreign.user,
    )
    DeviceFactory(organization=org_a, label="first", last_user=foreign.user, id=UUID(int=3))
    path = "/api/v1/devices/"
    for term in ["zeta", "serial-match", "version-match", "matched-user"]:
        assert [row["id"] for row in paged_rows(table_admin, path, {"search": term})] == [
            str(found.pk)
        ]
    assert paged_rows(table_admin, path, {"search": "foreign-only"}) == []
    assert [row["id"] for row in paged_rows(table_admin, path, {"ordering": "label"})] == [
        str(UUID(int=2)),
        str(UUID(int=3)),
        str(found.pk),
    ]
    assert [row["id"] for row in paged_rows(table_admin, path, {"ordering": "-label"})] == [
        str(found.pk),
        str(UUID(int=2)),
        str(UUID(int=3)),
    ]
    # List parameters cannot hide a detail or redirect revocation to another device.
    assert (
        table_admin.get(f"{path}{found.pk}/?search=absent&ordering=unsupported").status_code == 200
    )


def create_history_parent(organization, kind):
    from geography.models import Block, Quadrant, SamplingPoint
    from organizations.models import Center

    center = Center.objects.create(organization=organization, code="C-224", name="Test center")
    quadrant = Quadrant.objects.create(organization=organization, center=center, code="Q-224")
    if kind == "quadrants":
        return quadrant
    block = Block.objects.create(organization=organization, quadrant=quadrant, code="B-224")
    if kind == "blocks":
        return block
    return SamplingPoint.objects.create(organization=organization, block=block, code="P-224")


@pytest.mark.django_db
@pytest.mark.parametrize("kind", ["quadrants", "blocks", "sampling-points"])
def test_geography_history_filters_and_orders_authorized_parent_before_paging(
    table_admin, org_a, org_b, kind
):
    from geography.models import BlockVersion, PointVersion, QuadrantVersion
    from tests.test_geography_b_11 import polygon

    parent = create_history_parent(org_a, kind)
    foreign = create_history_parent(org_b, kind)
    author, other_author = UserFactory.create_batch(2)
    instant = datetime(2026, 1, 10, tzinfo=UTC)
    model, relation, number = {
        "quadrants": (QuadrantVersion, "quadrant", "revision"),
        "blocks": (BlockVersion, "block", "revision"),
        "sampling-points": (PointVersion, "point", "version"),
    }[kind]
    for revision, actor in [(3, author), (1, other_author), (2, author)]:
        geometry = (
            {"location": [-99.99, 20.005], "is_retired": revision == 3}
            if kind == "sampling-points"
            else {"geometry": polygon()}
        )
        model.objects.create(
            organization=org_a,
            **{relation: parent, number: revision},
            effective_from=instant + timedelta(days=revision),
            created_by=actor,
            **geometry,
        )
    path = f"/api/v1/{kind}/{parent.pk}/versions/"

    assert [row[number] for row in paged_rows(table_admin, path, {})] == [3, 2, 1]
    assert [
        row[number] for row in paged_rows(table_admin, path, {"ordering": "effective_from"})
    ] == [1, 2, 3]
    assert [
        row[number]
        for row in paged_rows(
            table_admin, path, {"ordering": "-effective_from", "created_by": str(author.pk)}
        )
    ] == [3, 2]
    assert [
        row[number]
        for row in paged_rows(
            table_admin,
            path,
            {
                "effective_from_from": (instant + timedelta(days=2)).isoformat(),
                "effective_from_before": (instant + timedelta(days=3)).isoformat(),
            },
        )
    ] == [2]
    assert [row[number] for row in paged_rows(table_admin, path, {number: 1})] == [1]
    if kind == "sampling-points":
        assert [row[number] for row in paged_rows(table_admin, path, {"is_retired": "true"})] == [3]
    assert (
        table_admin.get(
            f"/api/v1/{kind}/{foreign.pk}/versions/", {number: 1, "ordering": "effective_from"}
        ).status_code
        == 404
    )
