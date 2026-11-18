"""Recount-bearing bag pages keep exact QA state without a query per obligation."""

import json
from itertools import count

import pytest
from rest_framework.renderers import JSONRenderer

from lab.access import LabTarget
from lab.commands import execute_lab_command
from lab.independent_qa.selectors import obligation_resolution
from lab.models import LabResultRevision, RecountRequest
from tests.lab_support import (
    actor_with_codes,
    capture_bag,
    command,
    count_input,
    lab_context,
    receive,
)
from tests.query_budget import assert_constant_queries
from tests.test_lab_recounts_b_19 import configure_qa, qa_command

pytestmark = pytest.mark.django_db


def _resolve_request(counter, request, method):
    _, claimed = qa_command(
        counter, request, "recount_claim", {"expected_revision": 0, "role": "second"}
    )
    assert claimed.status == 201
    _, observed = qa_command(
        counter,
        request,
        "recount",
        {
            "request_id": request.pk,
            "expected_revision": 1,
            "expected_result_revision": 1,
            "value": 1,
            "confirmed_implausible": False,
            "method_version": method.pk,
        },
    )
    assert observed.status == 201
    _, resolved = qa_command(
        counter,
        request,
        "recount_adjudicate",
        {
            "expected_revision": 2,
            "expected_result_revision": 1,
            "final_attempt_id": request.count_id,
            "reason_code": "other",
            "reason": "Select the genuine first observation within the configured tolerance",
        },
    )
    assert resolved.status == 201


def test_bags_with_pending_and_resolved_recounts_have_constant_queries(
    monkeypatch, make_member, api_client
):
    context = lab_context(monkeypatch)
    method = configure_qa(context)
    counter = actor_with_codes(context, make_member, ("recount.create", "egg_count.read"))
    sequence = count(1)
    api_client.force_authenticate(context.actor.user)

    def add_rows(rows):
        for _ in range(rows):
            number = next(sequence)
            bag = capture_bag(context, code=f"QB-LAB-{number}", new_source=True, has_eggs=False)
            assert receive(context, bag).status == 200
            observed = execute_lab_command(context.actor, count_input(context, bag, 1))
            assert observed.status == 201
            request = RecountRequest.objects.get(count_id=observed.body["count"]["id"])
            if number % 2 == 0:
                _resolve_request(counter, request, method)

    assert_constant_queries(api_client, "/api/v1/bags/", add_rows)

    body = api_client.get("/api/v1/bags/").json()["results"]
    assert {row["lab"]["status"] for row in body} == {"counted", "awaiting_independent_qa"}
    for row in body:
        current = LabResultRevision.objects.filter(bag_id=row["id"]).first()
        request = current.count.recount_request
        expected = (
            "counted"
            if obligation_resolution(request, current) is not None
            else "awaiting_independent_qa"
        )
        assert row["lab"]["status"] == expected


def test_lab_reception_discrepancies_have_constant_queries_and_keep_pending_cases(
    monkeypatch, make_member, api_client
):
    context = lab_context(monkeypatch)
    # The field user collected the bags and reads the list; reception is a separate lab actor.
    reader = context.actor
    context.actor = actor_with_codes(context, make_member, ("bag.receive",))
    sequence = count(1)
    api_client.force_authenticate(reader.user)

    def add_rows(rows):
        for _ in range(rows):
            bag = capture_bag(context, code=f"QB-MISSING-{next(sequence)}", new_source=True)
            outcome = command(
                context,
                "missing",
                LabTarget("bag", bag.pk),
                {"reason": "Expected synthetic physical paddle was not received"},
            )
            assert outcome.status == 409
            assert outcome.body["code"] == "lab_configuration_unavailable"

    assert_constant_queries(api_client, "/api/v1/lab-reception-discrepancies/", add_rows)

    body = api_client.get("/api/v1/lab-reception-discrepancies/").json()["results"]
    assert len(body) == 10
    assert all(row["bag_code"].startswith("QB-MISSING-") for row in body)
    assert all(row["configuration_pending"] and row["incident_id"] is None for row in body)


def test_lab_method_version_queries_are_constant_with_exact_current_verification(
    monkeypatch, api_client
):
    from datetime import timedelta

    from lab.methods import decide_method, write_method
    from lab.models import LabMethodVersion
    from lab.serializers import LabMethodVersionSerializer
    from tests.lab_support import AT
    from tests.ovitrap_support import CAPTURED

    context = lab_context(monkeypatch)
    sequence = count(1)
    methods = []
    api_client.force_authenticate(context.actor.user)

    def add_rows(rows):
        for _ in range(rows):
            number = next(sequence)
            version = write_method(
                context.actor,
                {
                    **({"code": "QB-METHOD"} if not methods else {}),
                    "expected_revision": number - 1,
                    "name": f"Synthetic method revision {number}",
                    "procedure": "Synthetic technical procedure, no operational approval",
                    "reference": "Synthetic verification fixture",
                    "effective_from": AT + timedelta(days=1)
                    if number % 2 == 0
                    else CAPTURED + timedelta(minutes=number),
                    "supports_viability": True,
                    "supports_rejection": False,
                },
                None if not methods else methods[0],
            )
            if not methods:
                methods.append(version.method_id)
            if number % 3 != 1:
                decide_method(
                    context.actor,
                    version.pk,
                    {
                        "expected_revision": 0,
                        "decision": "verify",
                        "reference": "Synthetic authored verification",
                    },
                )
                if number % 3 == 0:
                    decide_method(
                        context.actor,
                        version.pk,
                        {
                            "expected_revision": 1,
                            "decision": "withdraw",
                            "reference": "Synthetic authored withdrawal",
                        },
                    )

    # The same method owns both pages; its revision history grows from two to ten rows.
    add_rows(2)
    url = f"/api/v1/lab-methods/{methods[0]}/versions/"
    from tests.query_budget import count_queries

    count_queries(api_client, url)
    small, small_rows = count_queries(api_client, url)
    add_rows(8)
    large, large_rows = count_queries(api_client, url)
    assert (small_rows, large_rows) == (2, 10)
    from tests.query_budget import _shapes

    assert len(large) == len(small), (
        len(small),
        len(large),
        dict(_shapes(large) - _shapes(small)),
    )

    body = api_client.get(url).json()["results"]
    assert [row["revision"] for row in body] == list(range(10, 0, -1))
    assert body[0]["availability"] == "not_current"  # Future revision ten is not active.
    assert body[1]["availability"] == "withdrawn"  # Current revision nine's latest decision.
    for row in body:
        # The canonical per-row path, rendered to JSON like the page response.
        canonical = json.loads(
            JSONRenderer().render(
                LabMethodVersionSerializer(LabMethodVersion.objects.get(pk=row["id"])).data
            )
        )
        assert (row["availability"], row["verification"]) == (
            canonical["availability"],
            canonical["verification"],
        )
