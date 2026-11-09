"""Own qualification/scoring policy once; database groups cover real publication later."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from people.eligibility import AssessmentQuery, assess_training_eligibility
from people.exceptions import PeopleConflictError
from people.policy import (
    RubricPolicy,
    StreakState,
    ValidityWindow,
    advance_streak,
    score_evaluation,
)
from tests.people_support import (
    certify,
    evaluation_values,
    people_context,
    require_training,
    rubric_version,
    training_version,
    write_person,
)


@pytest.mark.parametrize(
    ("scores", "critical", "outcome", "total"),
    [
        ({"presentation": "100", "execution": "80", "coverage": "0"}, True, "low", "60"),
        ({"presentation": "80", "execution": "80", "coverage": "80"}, True, "pass", "80"),
        (
            {"presentation": "79.999", "execution": "79.999", "coverage": "79.999"},
            True,
            "low",
            "79.999",
        ),
        (
            {"presentation": "100", "execution": "100", "coverage": "100"},
            False,
            "critical_failure",
            "100",
        ),
        ({"presentation": "100", "execution": "100", "coverage": "100"}, None, "incomplete", None),
        ({"presentation": "100", "execution": None, "coverage": "100"}, True, "incomplete", None),
        ({"presentation": "0", "execution": "0", "coverage": "0"}, True, "low", "0"),
    ],
)
def test_scoring_uses_exact_pinned_weights_and_critical_completion(
    scores, critical, outcome, total
):
    policy = RubricPolicy(
        {"presentation": 20, "execution": 50, "coverage": 30}, Decimal("80"), ("safe",)
    )
    result = score_evaluation(
        policy,
        {key: None if value is None else Decimal(value) for key, value in scores.items()},
        {"safe": critical},
    )
    assert result.outcome == outcome
    assert result.total == (None if total is None else Decimal(total))


@pytest.mark.parametrize(
    "weights", [{}, {"presentation": 20}, {"presentation": 20, "execution": 50, "coverage": 29}]
)
def test_missing_or_incoherent_rubric_configuration_is_not_a_default_pass(weights):
    with pytest.raises(ValueError, match="rubric"):
        RubricPolicy(weights, Decimal("80"), ("safe",))


@pytest.mark.parametrize(
    ("instant", "code"),
    [("2026-02-30T12:00:00Z", "invalid"), ("2026-02-28T12:00:00", "naive_datetime")],
)
def test_people_instants_reject_invalid_calendar_and_naive_input_with_field_codes(instant, code):
    from people.serializers import TrainingVersionWriteSerializer

    serializer = TrainingVersionWriteSerializer(
        data={
            "command_id": str(uuid4()),
            "expected_revision": 0,
            "validity_seconds": 86400,
            "enabled_actions": ["release.record"],
            "effective_from": instant,
            "is_active": True,
        }
    )
    assert not serializer.is_valid()
    assert serializer.errors["effective_from"][0].code == code


def test_qualification_interval_is_aware_half_open_and_bounded_by_configured_duration():
    start = datetime(2026, 1, 1, tzinfo=UTC)
    end = start + timedelta(days=1)
    window = ValidityWindow(start, end, timedelta(days=1))
    assert window.includes(start)
    assert window.includes(end - timedelta(microseconds=1))
    assert not window.includes(end)
    assert not window.includes(start - timedelta(microseconds=1))
    for invalid_start, invalid_end, duration in (
        (start.replace(tzinfo=None), end, timedelta(days=1)),
        (start, start, timedelta(days=1)),
        (end, start, timedelta(days=1)),
        (start, end, timedelta(hours=23)),
    ):
        with pytest.raises(ValueError, match="validity"):
            ValidityWindow(invalid_start, invalid_end, duration)


def test_server_ordered_adverse_episode_ignores_incomplete_and_resets_only_on_pass():
    state = StreakState()
    state = advance_streak(state, "low", 1)
    state = advance_streak(state, "incomplete", None)
    state = advance_streak(state, "critical_failure", 2)
    third = advance_streak(state, "low", 3)
    assert (third.count, third.episode_start, third.trigger_sequence) == (3, 1, 3)
    fourth = advance_streak(third, "low", 4)
    assert (fourth.count, fourth.trigger_sequence) == (4, 3)
    reset = advance_streak(fourth, "pass", 5)
    assert (reset.count, reset.episode_start, reset.trigger_sequence) == (0, None, None)
    next_episode = advance_streak(reset, "critical_failure", 6)
    assert (next_episode.count, next_episode.episode_start, next_episode.trigger_sequence) == (
        1,
        6,
        None,
    )


@pytest.fixture
def people(org_a, make_member, monkeypatch, settings, tmp_path):
    return people_context(org_a, make_member, monkeypatch, settings, tmp_path)


@pytest.mark.django_db(transaction=True)
@pytest.mark.filterwarnings("error::django.core.paginator.UnorderedObjectListWarning")
def test_certificate_uses_actual_effective_version_and_retains_backdated_revoked_history(people):
    from django.http import Http404

    from people.models import Certification, CertificationRevocation, PeopleCommand
    from people.projections import original_assessment

    now = people.clock["now"]
    query = AssessmentQuery(
        people.organization, people.phone.user.pk, "release.record", people.context, now, now
    )
    unavailable = assess_training_eligibility(query)
    assert not unavailable["training_eligible"]
    assert unavailable["blockers"] == ["training_requirements_unavailable"]
    first = training_version(people)
    future = training_version(
        people, parent=first.training_id, revision=1, effective=now + timedelta(days=1)
    )
    require_training(people, future)
    certificate = certify(
        people, future, start=now - timedelta(hours=1), end=now + timedelta(days=2)
    )
    before = assess_training_eligibility(query)
    assert not before["training_eligible"]
    assert before["next_change_at"] == future.effective_from.isoformat()
    assert original_assessment(query, uuid4()) is None
    people.clock["now"] = future.effective_from
    at_start = assess_training_eligibility(
        AssessmentQuery(
            people.organization,
            query.subject_id,
            query.action,
            query.context,
            people.clock["now"],
            people.clock["now"],
        )
    )
    assert at_start["training_eligible"]
    assert at_start["certification_ids"] == [certificate["id"]]
    assert at_start["valid_from"] == future.effective_from.isoformat()
    target = UUID(certificate["id"])
    command_id = uuid4()
    revocation = {
        "expected_revision": 1,
        "effective_from": people.clock["now"],
        "reason_code": "other",
        "reason": "Genuine qualification withdrawn",
    }
    result = write_person(
        people, "certification.revoke", revocation, target=target, command_id=command_id
    )
    assert (
        write_person(
            people, "certification.revoke", revocation, target=target, command_id=command_id
        )
        == result
    )
    with pytest.raises(PeopleConflictError) as changed:
        write_person(
            people,
            "certification.revoke",
            {**revocation, "reason": "Different qualification withdrawal"},
            target=target,
            command_id=command_id,
        )
    assert changed.value.blocked_by[0]["reason"] == "command_id_conflict"
    current = assess_training_eligibility(
        AssessmentQuery(
            people.organization,
            query.subject_id,
            query.action,
            query.context,
            people.clock["now"],
            people.clock["now"],
        )
    )
    assert not current["training_eligible"]
    assert current["revocation_ids"] == [result["id"]]
    assert Certification.objects.get(pk=target).training_version_id == future.pk
    assert CertificationRevocation.objects.filter(certification_id=target).count() == 1
    assert PeopleCommand.objects.filter(command_id=command_id).count() == 1
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(people.actor.user)
    history = client.get(f"/api/v1/users/{people.phone.user.pk}/trainings/{target}/revocations/")
    assert history.status_code == 200, history.data
    assert [row["id"] for row in history.data["results"]] == [result["id"]]
    assert client.get(f"/api/v1/users/{uuid4()}/trainings/{target}/revocations/").status_code == 404
    people.profile.permission_codes = []
    people.profile.save(update_fields=["permission_codes"])
    with pytest.raises(Http404):
        write_person(
            people, "certification.revoke", revocation, target=target, command_id=command_id
        )


@pytest.mark.django_db(transaction=True)
@pytest.mark.filterwarnings("error::django.core.paginator.UnorderedObjectListWarning")
def test_completion_notice_routing_is_current_before_deferred_reassessment_and_exact_replay(
    people, make_member
):
    from django.http import Http404

    from geography.models import Quadrant
    from organizations.models import Center, all_scope
    from people.models import (
        EvaluationAttempt,
        EvaluationCompletion,
        EvaluationNoticePolicyVersion,
        EvaluationVoid,
        PeopleCommand,
        TrainingNoticeCause,
        TrainingNoticeIntent,
        TrainingNoticeRoute,
    )
    from people.notices import recover_notice

    rubric = rubric_version(people)
    _, hr = make_member(people.organization, ("evaluation.read",))
    hr.scope = all_scope()
    hr.save(update_fields=["scope"])
    hr_profile = hr.profiles.get()
    hr_profile.scope = all_scope()
    hr_profile.save(update_fields=["scope"])
    policy_values = {**people.context.lookups(), "recipient_membership_id": hr.pk}
    write_person(people, "notice_policy.version", policy_values)
    results = []
    for score, safe, backwards in (("60", True, 0), ("100", False, 2), ("60", True, 5)):
        values = evaluation_values(
            people,
            rubric,
            score=score,
            safe=safe,
            observed=people.clock["now"] - timedelta(days=backwards),
        )
        results.append(write_person(people, "evaluation.create", values))
        if len(results) == 1:
            reset = write_person(
                people, "evaluation.create", evaluation_values(people, rubric, score="90")
            )
    assert [answer["evaluation"]["completion_sequence"] for answer in results] == [1, 3, 4]
    assert not TrainingNoticeCause.objects.exists()
    correction_id = uuid4()
    correction_values = {
        "expected_revision": 1,
        "expected_completion_sequence": 4,
        "reason_code": "other",
        "reason": "Remove the incorrectly recorded synthetic pass",
    }
    corrected_reset = write_person(
        people,
        "evaluation.void",
        correction_values,
        target=UUID(reset["id"]),
        command_id=correction_id,
    )
    assert (
        write_person(
            people,
            "evaluation.void",
            correction_values,
            target=UUID(reset["id"]),
            command_id=correction_id,
        )
        == corrected_reset
    )
    cause = TrainingNoticeCause.objects.get()
    assert cause.completion_id == EvaluationCompletion.objects.get(sequence=4).pk
    assert cause.created_by_id == EvaluationCompletion.objects.get(sequence=4).created_by_id
    assert EvaluationVoid.objects.get(pk=corrected_reset["id"]).evaluation_id == UUID(reset["id"])
    incomplete = write_person(
        people, "evaluation.create", evaluation_values(people, rubric, score="100", safe=None)
    )
    assert incomplete["evaluation"]["completion_sequence"] is None
    assert incomplete["evaluation"]["score"] is None
    recover_notice(cause.pk)
    assert cause.publications.latest("attempt_number").status == "delivery_unavailable"
    assert TrainingNoticeIntent.objects.filter(cause=cause).count() == 1
    reroute = {**policy_values, "expected_revision": 1, "reroute_cause_ids": [cause.pk]}
    identifier = uuid4()
    accepted = write_person(people, "notice_policy.version", reroute, command_id=identifier)
    assert write_person(people, "notice_policy.version", reroute, command_id=identifier) == accepted
    assert TrainingNoticeRoute.objects.filter(cause=cause).count() == 1
    center_b = Center.objects.create(
        organization=people.organization,
        created_by=people.actor.user,
        code="B03-B",
        name="Synthetic second training context",
    )
    quadrant_b = Quadrant.objects.create(
        organization=people.organization,
        created_by=people.actor.user,
        center=center_b,
        code="B03-QB",
    )
    bound_a = {
        "centers": {"mode": "selected", "ids": [str(people.center.pk)]},
        "quadrants": {"mode": "selected", "ids": [str(people.quadrant.pk)]},
    }
    hr_profile.scope = bound_a
    hr_profile.save(update_fields=["scope"])
    fourth = write_person(
        people,
        "evaluation.create",
        {
            **evaluation_values(people, rubric),
            "center_id": center_b.pk,
            "quadrant_id": quadrant_b.pk,
        },
    )
    assert fourth["evaluation"]["completion_sequence"] == 5
    assert TrainingNoticeCause.objects.count() == 1
    assert recover_notice(cause.pk)
    unavailable = cause.publications.latest("attempt_number")
    assert unavailable.status == "recipient_unconfigured"
    assert unavailable.intent_id is None
    assert len(unavailable.assessment["facts"]) == 4
    assert {row["center_id"] for row in unavailable.assessment["contexts"]} == {
        str(people.center.pk),
        str(center_b.pk),
    }
    assert cause.contexts == [people.context.payload()]
    assert TrainingNoticeIntent.objects.filter(cause=cause).count() == 1
    people.profile.scope = bound_a
    people.profile.save(update_fields=["scope"])
    with pytest.raises(Http404):
        write_person(people, "notice_policy.version", {**reroute, "expected_revision": 2})
    assert EvaluationNoticePolicyVersion.objects.count() == 2
    assert TrainingNoticeRoute.objects.filter(cause=cause).count() == 1
    people.profile.scope = all_scope()
    people.profile.save(update_fields=["scope"])
    passed = write_person(
        people, "evaluation.create", evaluation_values(people, rubric, score="90")
    )
    assert passed["evaluation"]["completion_sequence"] == 6
    # Transport is still deferred: persisted publication remains unavailable, not superseded.
    assert cause.publications.latest("attempt_number").status == unavailable.status
    rejected_id = uuid4()
    with pytest.raises(PeopleConflictError) as obsolete:
        write_person(
            people,
            "notice_policy.version",
            {**reroute, "expected_revision": 2},
            command_id=rejected_id,
        )
    assert obsolete.value.blocked_by[0]["reason"] == "notice_cause_superseded"
    assert EvaluationNoticePolicyVersion.objects.count() == 2
    assert not PeopleCommand.objects.filter(command_id=rejected_id).exists()
    assert TrainingNoticeRoute.objects.filter(cause=cause).count() == 1
    recover_notice(cause.pk)
    assert cause.publications.latest("attempt_number").status == "superseded"
    assert TrainingNoticeCause.objects.count() == 1
    # A corrected old pass cannot rewrite observation/rubric or restore the original command.
    successor = evaluation_values(people, rubric, score="50")
    corrected = write_person(
        people,
        "evaluation.revise",
        {
            **successor,
            "expected_revision": 1,
            "expected_completion_sequence": 6,
            "reason_code": "other",
            "reason": "Correct synthetic observation",
        },
        target=UUID(passed["id"]),
    )
    assert corrected["evaluation"]["completion_sequence"] == 7
    assert EvaluationAttempt.objects.filter(evaluation_id=passed["id"]).count() == 2
    assert list(
        EvaluationCompletion.objects.order_by("sequence").values_list("sequence", flat=True)
    ) == [1, 2, 3, 4, 5, 6, 7]
    voided = write_person(
        people,
        "evaluation.void",
        {
            "expected_revision": 2,
            "expected_completion_sequence": 7,
            "reason_code": "other",
            "reason": "Void retained synthetic observation",
        },
        target=UUID(passed["id"]),
    )
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(people.actor.user)
    attempts = client.get(f"/api/v1/evaluations/{passed['id']}/attempts/?page_size=1")
    assert attempts.status_code == 200, attempts.data
    assert attempts.data["count"] == 2
    assert attempts.data["results"][0]["id"] == passed["evaluation"]["attempt_id"]
    retained = client.get("/api/v1/evaluations/?include_voided=true").data["results"]
    original = next(row for row in retained if row["id"] == passed["id"])
    assert original["is_voided"]
    assert original["void"]["id"] == voided["id"]
    assert original["current"]["id"] == corrected["evaluation"]["attempt_id"]


@pytest.mark.django_db(transaction=True)
def test_people_http_keeps_csrf_private_reads_and_complete_context_scope(people, org_b):
    from rest_framework.test import APIClient

    from organizations.models import Center, all_scope
    from tests.factories import ProfileFactory

    csrf = APIClient(enforce_csrf_checks=True)
    csrf.force_login(people.actor.user)
    body = {
        "command_id": str(uuid4()),
        "expected_revision": 0,
        "code": "HTTP-C",
        "name": "Synthetic HTTP course",
    }
    assert csrf.post("/api/v1/trainings/", body, format="json").status_code == 403
    client = APIClient()
    client.force_authenticate(people.actor.user)
    created = client.post("/api/v1/trainings/", body, format="json")
    assert created.status_code == 201, created.data
    assert client.post("/api/v1/trainings/", body, format="json").data == created.data
    conflict = client.post("/api/v1/trainings/", {**body, "name": "Different body"}, format="json")
    assert conflict.status_code == 409
    rubric = rubric_version(people)
    invalid_observation = client.post(
        "/api/v1/evaluations/",
        {
            "command_id": str(uuid4()),
            "expected_revision": 0,
            "subject": str(people.phone.user.pk),
            "center": str(people.center.pk),
            "quadrant": str(people.quadrant.pk),
            "rubric_version": str(rubric.pk),
            "section_scores": {"presentation": "80", "execution": "80", "coverage": "80"},
            "critical_responses": {"safe": True, "unknown": True},
            "observed_at": people.clock["now"].isoformat(),
        },
        format="json",
    )
    assert invalid_observation.status_code == 400, invalid_observation.data
    assert invalid_observation.data["fields"]["critical_responses"][0]["code"] == "unknown_check"
    evaluation = write_person(people, "evaluation.create", evaluation_values(people, rubric))
    filtered = client.get(f"/api/v1/evaluations/?subject={people.phone.user.pk}")
    assert filtered.status_code == 200, filtered.data
    assert [row["id"] for row in filtered.data["results"]] == [evaluation["id"]]
    assert client.get(f"/api/v1/evaluations/?subject={uuid4()}").data["count"] == 0
    unsupported = client.get(f"/api/v1/evaluations/?training_version={uuid4()}")
    assert unsupported.status_code == 400, unsupported.data
    assert unsupported.data["fields"]["training_version"][0]["code"] == "unsupported_filter"
    for endpoint in ("training-requirements", "evaluation-notice-policy"):
        rejected = client.get(f"/api/v1/{endpoint}/?subject={people.phone.user.pk}")
        assert rejected.status_code == 400, rejected.data
        assert rejected.data["fields"]["subject"][0]["code"] == "unsupported_filter"
    version = training_version(people)
    certificate = certify(people, version)
    requirement = {
        "command_id": str(uuid4()),
        "expected_revision": 0,
        "center": str(people.center.pk),
        "quadrant": str(people.quadrant.pk),
        "effective_from": people.clock["now"].isoformat(),
        "acceptable_versions": {str(version.training_id): [str(version.pk)]},
    }
    configured = client.post(
        "/api/v1/training-requirements/release.record/versions/", requirement, format="json"
    )
    assert configured.status_code == 201, configured.data
    foreign = Center.objects.create(
        organization=org_b, code="FOREIGN", name="Synthetic foreign center"
    )
    hidden = {
        "command_id": str(uuid4()),
        "expected_revision": 0,
        "center": str(foreign.pk),
        "quadrant": None,
        "training_version": str(version.pk),
        "valid_from": people.clock["now"].isoformat(),
        "valid_to": (people.clock["now"] + timedelta(days=1)).isoformat(),
        "evidence_ids": [str(uuid4())],
        "issuer_reference": "Synthetic reference",
        "attestation": "Synthetic verification",
    }
    assert (
        client.post(
            f"/api/v1/users/{people.phone.user.pk}/trainings/", hidden, format="json"
        ).status_code
        == 404
    )
    people.profile.permission_codes = ["training.read"]
    people.profile.save(update_fields=["permission_codes"])
    summary = client.get(f"/api/v1/users/{people.phone.user.pk}/trainings/")
    assert summary.status_code == 200, summary.data
    assert summary.data["results"][0]["id"] == certificate["id"]
    assert (
        not {"evidence_ids", "attestation", "issuer_reference", "created_by"}
        & summary.data["results"][0].keys()
    )
    assert (
        client.get(f"/api/v1/users/{people.phone.user.pk}/trainings/?proof=true").status_code == 403
    )
    assert client.get("/api/v1/evaluations/").status_code == 403
    people.subject.is_active = False
    people.subject.save(update_fields=["is_active"])
    assert client.get(f"/api/v1/users/{people.phone.user.pk}/trainings/").status_code == 200
    # Two incomplete granting pairs cannot synthesize authority over this real pair.
    people.member.scope = all_scope()
    people.member.save(update_fields=["scope"])
    people.profile.permission_codes = ["training.manage"]
    people.profile.scope = {
        "centers": {"mode": "selected", "ids": [str(people.center.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    people.profile.save(update_fields=["permission_codes", "scope"])
    other = ProfileFactory(
        organization=people.organization,
        permission_codes=["training.manage"],
        scope={
            "centers": {"mode": "none", "ids": []},
            "quadrants": {"mode": "selected", "ids": [str(people.quadrant.pk)]},
        },
    )
    people.member.profiles.add(other)
    requirement = {**requirement, "command_id": str(uuid4()), "expected_revision": 1}
    assert (
        client.post(
            "/api/v1/training-requirements/release.record/versions/", requirement, format="json"
        ).status_code
        == 404
    )


@pytest.mark.django_db(transaction=True)
def test_due_expiry_recovery_keeps_one_truthful_self_intent_and_never_claims_delivery(people):
    from people.models import TrainingNoticeCause, TrainingNoticeIntent
    from people.notices import recover_due_notices

    version = training_version(people)
    end = people.clock["now"] + timedelta(seconds=30)
    certificate = certify(people, version, end=end)
    assert recover_due_notices()["expiries_observed"] == 0
    people.clock["now"] = end
    assert recover_due_notices()["expiries_observed"] == 1
    assert recover_due_notices()["expiries_observed"] == 0
    cause = TrainingNoticeCause.objects.get(certification_id=certificate["id"])
    assert cause.due_at == end
    intent = TrainingNoticeIntent.objects.get(cause=cause)
    assert intent.recipient_membership_id == people.subject.pk
    assert set(cause.publications.values_list("status", flat=True)) == {"delivery_unavailable"}
    assert all(cause.publications.values_list("not_published", flat=True))
