from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from core.exceptions import FieldValidationError
from rules.models import ValueType
from rules.selectors import (
    build_rules_snapshot,
    get_next_change_at,
    get_values_in_force,
    get_version_in_force,
    list_parameters_with_current,
    list_versions,
)
from rules.services import RuleVersionSpec, create_rule_version, resolve_effective_from
from tests.factories import (
    OrganizationFactory,
    RuleParameterFactory,
    RuleParameterVersionFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db

# 2026-11-03 20:00 in Mexico City (UTC-6) is already 2026-11-04 02:00 in UTC.
NOW = datetime(2026, 11, 4, 2, 0, tzinfo=UTC)
MEXICO = "America/Mexico_City"


@pytest.fixture
def now(monkeypatch: pytest.MonkeyPatch) -> datetime:
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    return NOW


def spec(
    value: str = "60", on: date = date(2026, 11, 10), reason: str = "adjust"
) -> RuleVersionSpec:
    return RuleVersionSpec(value=Decimal(value), effective_date=on, reason=reason)


def field_error(error: pytest.ExceptionInfo[FieldValidationError]) -> tuple[str, str]:
    [(field, [detail])] = error.value.fields.items()
    return field, detail["code"]


def test_future_date_takes_effect_at_local_midnight_not_utc_midnight() -> None:
    result = resolve_effective_from(date(2026, 11, 10), MEXICO, NOW)

    assert result == datetime(2026, 11, 10, 6, 0, tzinfo=UTC)


def test_today_takes_effect_now_never_retroactively() -> None:
    assert resolve_effective_from(date(2026, 11, 3), MEXICO, NOW) == NOW


def test_today_is_the_local_date_not_the_utc_date() -> None:
    with pytest.raises(FieldValidationError) as error:
        resolve_effective_from(date(2026, 11, 2), MEXICO, NOW)

    assert error.value.fields["effective_from"][0]["code"] == "effective_from_in_past"


def test_the_utc_date_is_in_the_future_for_a_western_organization(now) -> None:
    assert resolve_effective_from(date(2026, 11, 4), MEXICO, NOW) > NOW


def test_create_version_stores_instant_local_date_reason_and_author(now) -> None:
    parameter = RuleParameterFactory(organization=OrganizationFactory(timezone=MEXICO))
    user = UserFactory()

    version = create_rule_version(parameter, spec("60", date(2026, 11, 10), "new rule"), user)

    assert version.effective_from == datetime(2026, 11, 10, 6, 0, tzinfo=UTC)
    assert (version.effective_date, version.reason, version.created_by) == (
        date(2026, 11, 10),
        "new rule",
        user,
    )
    assert version.organization_id == parameter.organization_id


def test_create_version_keeps_the_previous_versions_untouched(now) -> None:
    parameter = RuleParameterFactory()
    old = RuleParameterVersionFactory(
        parameter=parameter, value=50, effective_date=date(2026, 1, 1)
    )

    create_rule_version(parameter, spec("60"), UserFactory())

    old.refresh_from_db()
    assert old.value == 50
    assert parameter.versions.count() == 2


def test_past_date_is_rejected(now) -> None:
    with pytest.raises(FieldValidationError) as error:
        create_rule_version(RuleParameterFactory(), spec(on=date(2026, 11, 1)), UserFactory())

    assert field_error(error) == ("effective_from", "effective_from_in_past")


def test_a_second_version_on_the_same_local_date_is_rejected(now) -> None:
    parameter = RuleParameterFactory()
    create_rule_version(parameter, spec(on=date(2026, 11, 10)), UserFactory())

    with pytest.raises(FieldValidationError) as error:
        create_rule_version(parameter, spec("70", date(2026, 11, 10)), UserFactory())

    assert field_error(error) == ("effective_from", "duplicate_effective_date")
    assert parameter.versions.count() == 1


def test_another_parameter_may_use_the_same_date(now) -> None:
    create_rule_version(RuleParameterFactory(), spec(), UserFactory())

    create_rule_version(RuleParameterFactory(), spec(), UserFactory())


def test_integer_parameter_rejects_a_fraction(now) -> None:
    parameter = RuleParameterFactory(value_type=ValueType.INTEGER)

    with pytest.raises(FieldValidationError) as error:
        create_rule_version(parameter, spec("50.5"), UserFactory())

    assert field_error(error) == ("value", "not_an_integer")


def test_integer_parameter_accepts_a_whole_decimal(now) -> None:
    parameter = RuleParameterFactory(value_type=ValueType.INTEGER)

    version = create_rule_version(parameter, spec("50.000"), UserFactory())

    assert version.value == 50


def test_decimal_parameter_accepts_a_fraction(now) -> None:
    parameter = RuleParameterFactory(value_type=ValueType.DECIMAL)

    assert create_rule_version(parameter, spec("12.345"), UserFactory()).value == Decimal("12.345")


@pytest.mark.parametrize("value", ["-1", "101"])
def test_value_out_of_range_reports_the_bounds(now, value) -> None:
    parameter = RuleParameterFactory(min_value=0, max_value=100)

    with pytest.raises(FieldValidationError) as error:
        create_rule_version(parameter, spec(value), UserFactory())

    assert error.value.fields["value"] == [
        {"code": "out_of_range", "params": {"min": 0, "max": 100}}
    ]


@pytest.mark.parametrize("value", ["0", "100"])
def test_bounds_are_inclusive(now, value) -> None:
    parameter = RuleParameterFactory(min_value=0, max_value=100)

    assert create_rule_version(parameter, spec(value), UserFactory()).value == Decimal(value)


def test_unbounded_parameter_reports_null_bounds(now) -> None:
    parameter = RuleParameterFactory(min_value=0, max_value=None)

    with pytest.raises(FieldValidationError) as error:
        create_rule_version(parameter, spec("-1"), UserFactory())

    assert error.value.fields["value"][0]["params"] == {"min": 0, "max": None}


def test_version_in_force_is_the_latest_that_already_started() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(
        parameter=parameter,
        value=1,
        effective_from=NOW - timedelta(days=9),
        effective_date=date(2026, 10, 26),
    )
    current = RuleParameterVersionFactory(
        parameter=parameter,
        value=2,
        effective_from=NOW - timedelta(days=1),
        effective_date=date(2026, 11, 3),
    )
    RuleParameterVersionFactory(
        parameter=parameter,
        value=3,
        effective_from=NOW + timedelta(days=1),
        effective_date=date(2026, 11, 5),
    )

    assert get_version_in_force(parameter, NOW) == current


def test_no_version_in_force_before_the_first_one_starts() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(
        parameter=parameter,
        effective_from=NOW + timedelta(days=1),
        effective_date=date(2026, 11, 5),
    )

    assert get_version_in_force(parameter, NOW) is None


def test_history_lists_superseded_in_force_and_scheduled() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(
        parameter=parameter,
        value=1,
        effective_from=NOW - timedelta(days=9),
        effective_date=date(2026, 10, 26),
    )
    RuleParameterVersionFactory(
        parameter=parameter,
        value=2,
        effective_from=NOW - timedelta(days=1),
        effective_date=date(2026, 11, 3),
    )
    RuleParameterVersionFactory(
        parameter=parameter,
        value=3,
        effective_from=NOW + timedelta(days=1),
        effective_date=date(2026, 11, 5),
    )

    history = [(v.value, v.status) for v in list_versions(parameter, NOW)]

    assert history == [(3, "scheduled"), (2, "in_force"), (1, "superseded")]


def test_history_of_a_parameter_with_only_future_versions_has_none_in_force() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(
        parameter=parameter,
        effective_from=NOW + timedelta(days=1),
        effective_date=date(2026, 11, 5),
    )

    assert [v.status for v in list_versions(parameter, NOW)] == ["scheduled"]


def test_parameters_are_listed_with_current_value_and_next_change_in_one_query(
    django_assert_num_queries,
) -> None:
    organization = OrganizationFactory()
    for index in range(3):
        parameter = RuleParameterFactory(organization=organization, key=f"p_{index}")
        RuleParameterVersionFactory(
            parameter=parameter,
            value=index,
            effective_from=NOW - timedelta(days=1),
            effective_date=date(2026, 11, 3),
        )
        RuleParameterVersionFactory(
            parameter=parameter,
            value=9,
            effective_from=NOW + timedelta(days=2),
            effective_date=date(2026, 11, 6),
        )

    with django_assert_num_queries(1):
        rows = [
            (p.key, p.current_value, p.next_change_at)
            for p in list_parameters_with_current(organization, NOW)
        ]

    assert rows[0] == ("p_0", Decimal(0), NOW + timedelta(days=2))
    assert len(rows) == 3


def test_next_change_at_is_the_earliest_future_version_of_the_organization() -> None:
    organization = OrganizationFactory()
    a = RuleParameterFactory(organization=organization)
    b = RuleParameterFactory(organization=organization)
    RuleParameterVersionFactory(
        parameter=a, effective_from=NOW + timedelta(days=5), effective_date=date(2026, 11, 9)
    )
    RuleParameterVersionFactory(
        parameter=b, effective_from=NOW + timedelta(days=2), effective_date=date(2026, 11, 6)
    )
    RuleParameterVersionFactory(
        parameter=RuleParameterFactory(),
        effective_from=NOW + timedelta(days=1),
        effective_date=date(2026, 11, 5),
    )

    assert get_next_change_at(organization, NOW) == NOW + timedelta(days=2)


def test_next_change_at_is_none_without_future_versions() -> None:
    assert get_next_change_at(OrganizationFactory(), NOW) is None


def test_values_in_force_cover_every_parameter_including_those_without_value() -> None:
    organization = OrganizationFactory()
    with_value = RuleParameterFactory(organization=organization, key="with_value")
    RuleParameterFactory(organization=organization, key="without_value")
    RuleParameterVersionFactory(parameter=with_value, value=7)

    assert get_values_in_force(organization, NOW) == {
        "with_value": Decimal(7),
        "without_value": None,
    }


def test_values_in_force_look_back_to_an_earlier_instant() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(
        parameter=parameter,
        value=1,
        effective_from=NOW - timedelta(days=9),
        effective_date=date(2026, 10, 26),
    )
    RuleParameterVersionFactory(
        parameter=parameter,
        value=2,
        effective_from=NOW - timedelta(days=1),
        effective_date=date(2026, 11, 3),
    )
    org = parameter.organization

    assert get_values_in_force(org, NOW - timedelta(days=5))[parameter.key] == 1
    assert get_values_in_force(org, NOW)[parameter.key] == 2


def test_snapshot_exposes_values_as_numbers_and_null_without_version() -> None:
    organization = OrganizationFactory()
    meters = RuleParameterFactory(
        organization=organization, key="a_meters", value_type=ValueType.INTEGER
    )
    ratio = RuleParameterFactory(
        organization=organization, key="b_ratio", value_type=ValueType.DECIMAL
    )
    RuleParameterFactory(organization=organization, key="c_unset")
    RuleParameterVersionFactory(parameter=meters, value=50)
    RuleParameterVersionFactory(parameter=ratio, value="1.500")

    snapshot = build_rules_snapshot(organization, NOW)

    values = {p["key"]: p["value"] for p in snapshot["parameters"]}
    assert values == {"a_meters": 50, "b_ratio": 1.5, "c_unset": None}
    assert isinstance(values["a_meters"], int)


def test_future_version_excluded_and_next_change_at_exposed() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(
        parameter=parameter,
        value=50,
        effective_from=NOW - timedelta(days=1),
        effective_date=date(2026, 11, 3),
    )
    RuleParameterVersionFactory(
        parameter=parameter,
        value=60,
        effective_from=NOW + timedelta(days=2),
        effective_date=date(2026, 11, 6),
    )

    snapshot = build_rules_snapshot(parameter.organization, NOW)

    assert snapshot["parameters"][0]["value"] == 50
    assert snapshot["next_change_at"] == "2026-11-06T02:00:00Z"


def test_rules_version_changes_when_a_scheduled_version_becomes_effective() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(
        parameter=parameter,
        value=50,
        effective_from=NOW - timedelta(days=1),
        effective_date=date(2026, 11, 3),
    )
    RuleParameterVersionFactory(
        parameter=parameter,
        value=60,
        effective_from=NOW + timedelta(days=2),
        effective_date=date(2026, 11, 6),
    )
    organization = parameter.organization

    before = build_rules_snapshot(organization, NOW)
    same = build_rules_snapshot(organization, NOW + timedelta(hours=1))
    after = build_rules_snapshot(organization, NOW + timedelta(days=2, hours=1))

    assert same["version"] == before["version"]
    assert after["version"] != before["version"]
    assert after["parameters"][0]["value"] == 60
    assert after["next_change_at"] is None


def test_rules_version_changes_when_a_future_version_is_scheduled() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(parameter=parameter, value=50)
    before = build_rules_snapshot(parameter.organization, NOW)["version"]

    RuleParameterVersionFactory(
        parameter=parameter,
        value=60,
        effective_from=NOW + timedelta(days=2),
        effective_date=date(2026, 11, 6),
    )

    assert build_rules_snapshot(parameter.organization, NOW)["version"] != before


def test_snapshot_never_includes_other_organizations() -> None:
    mine = RuleParameterFactory(key="mine")
    RuleParameterFactory(key="foreign")

    snapshot = build_rules_snapshot(mine.organization, NOW)

    assert [p["key"] for p in snapshot["parameters"]] == ["mine"]
