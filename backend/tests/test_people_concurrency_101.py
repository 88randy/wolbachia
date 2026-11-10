"""Real prepared account/Org barriers own both completion ordering outcomes."""

import threading
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from django.db import close_old_connections

from field_sync.exceptions import SyncInProgressError
from people.models import EvaluationCompletion, TrainingNoticeCause
from tests.people_support import evaluation_values, people_context, rubric_version, write_person


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("winner_kind", ["third_adverse", "pass"])
def test_completed_third_adverse_and_pass_have_one_ordered_winner_and_exact_retry(
    winner_kind, org_a, make_member, monkeypatch, settings, tmp_path
):
    import people.services as services

    context = people_context(org_a, make_member, monkeypatch, settings, tmp_path)
    rubric = rubric_version(context)
    for _ in range(2):
        write_person(context, "evaluation.create", evaluation_values(context, rubric))
    entered, release = threading.Event(), threading.Event()
    identifier = uuid4()
    first_values = evaluation_values(
        context, rubric, score="60" if winner_kind == "third_adverse" else "90"
    )
    second_values = evaluation_values(
        context, rubric, score="90" if winner_kind == "third_adverse" else "60"
    )
    append = services._append_attempt

    def retain_winner(command, evaluation, predecessor):
        answer = append(command, evaluation, predecessor)
        if command.command_id == identifier:
            entered.set()
            assert release.wait(10)
        return answer

    monkeypatch.setattr(services, "_append_attempt", retain_winner)

    def run_winner():
        close_old_connections()
        try:
            return write_person(context, "evaluation.create", first_values, command_id=identifier)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        winner = pool.submit(run_winner)
        try:
            assert entered.wait(10)
            with pytest.raises(SyncInProgressError):
                write_person(context, "evaluation.create", second_values)
        finally:
            release.set()
        committed = winner.result()
    retried = write_person(context, "evaluation.create", second_values)
    assert [
        committed["evaluation"]["completion_sequence"],
        retried["evaluation"]["completion_sequence"],
    ] == [3, 4]
    assert list(
        EvaluationCompletion.objects.order_by("sequence").values_list("sequence", flat=True)
    ) == [1, 2, 3, 4]
    assert TrainingNoticeCause.objects.count() == (1 if winner_kind == "third_adverse" else 0)
    assert (
        write_person(context, "evaluation.create", first_values, command_id=identifier) == committed
    )
