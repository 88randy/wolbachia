"""Lab observation, reporting and daily-quota invariants; no database is needed."""

from decimal import Decimal

import pytest

from lab.policies import (
    CountFacts,
    ExaminedFacts,
    LabPolicyError,
    evaluate_count,
    sample_size,
    viability,
)


@pytest.mark.parametrize("invalid", [True, -1, 1.5, 2**53])
def test_count_is_an_authoritative_nonnegative_integer(invalid):
    with pytest.raises(LabPolicyError, match="lab_integer_required"):
        evaluate_count(CountFacts(invalid, False, 1000, True))


def test_plausibility_confirmation_retains_large_observation_and_real_request_causes():
    assert evaluate_count(CountFacts(0, False, 1000, False)).recount_causes == ()
    assert evaluate_count(CountFacts(1000, False, 1000, True)).recount_causes == ()
    with pytest.raises(LabPolicyError, match="lab_confirmation_required"):
        evaluate_count(CountFacts(10001, False, 1000, False))
    result = evaluate_count(CountFacts(10001, True, 1000, False))
    assert result.recount_causes == ("implausible", "eggs_flag_absent")


def test_viability_preserves_exact_examined_sample_without_full_paddle_inference():
    assert viability(ExaminedFacts(1, 3)).percent == Decimal("33.333333")
    assert viability(ExaminedFacts(0, 3)).percent == Decimal("0.000000")
    zero = viability(ExaminedFacts(0, 0))
    assert zero.percent is None
    assert zero.reason == "zero_examined"
    with pytest.raises(LabPolicyError, match="lab_viability_invalid"):
        viability(ExaminedFacts(4, 3))


@pytest.mark.parametrize(("population", "expected"), [(0, 0), (1, 1), (20, 1), (21, 2)])
def test_closed_day_quota_rounds_up_with_a_nonempty_minimum(population, expected):
    assert sample_size(population, 5) == expected
