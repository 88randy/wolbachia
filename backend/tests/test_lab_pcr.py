"""PCR batches to external labs: status flow, results (Wolbachia attempts + dengue), CSV preview."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.http import Http404

from core.exceptions import FieldValidationError
from lab.exceptions import LabConflictError
from lab.pcr import services
from lab.pcr.csv_import import preview_csv, template_csv
from lab.pcr.models import PcrBatch, PcrResult
from lab.pcr.permissions import CODES as PCR_CODES
from lab.pcr.selectors import batch_detail, batch_status, batch_summary, eligible_samples
from lab.samples.models import WolbachiaResultAttempt
from organizations.models import Organization
from tests.test_lab_samples_b_21 import collect, samples_context  # noqa: F401 -- fixture
from uploads.access import UploadActor


def _tick(context, minutes=1):
    context.clock["now"] += timedelta(minutes=minutes)


@pytest.fixture
def pcr(samples_context):  # noqa: F811
    context = samples_context
    context.field.profile.permission_codes = [*context.field.profile.permission_codes, *PCR_CODES]
    context.field.profile.save(update_fields=["permission_codes"])
    sample, _capture = collect(context)
    lab = services.create_external_lab(context.actor, {"name": "Lab Externo Demo"})
    _tick(context)
    return context, sample, lab


def _batch(context, sample, lab, targets=("wolbachia", "dengue")):
    batch = services.create_batch(
        context.actor,
        {"external_lab_id": lab.pk, "targets": list(targets), "sample_ids": [sample.pk]},
    )
    _tick(context)
    return batch


def _to_received(context, batch):
    for kind, values in (
        ("ready", {}),
        ("ship", {"tracking_number": "GUIA-001", "carrier": "Estafeta"}),
        ("receive", {}),
    ):
        services.transition_batch(context.actor, batch.pk, kind, values)
        _tick(context)


@pytest.mark.django_db
def test_full_flow_records_wolbachia_attempt_and_dengue_result(pcr):
    context, sample, lab = pcr
    assert sample.pk in set(eligible_samples(context.actor).values_list("pk", flat=True))
    batch = _batch(context, sample, lab)
    assert batch.code.startswith("PCR-")
    assert batch_status(batch) == "preparing"
    assert not eligible_samples(context.actor).filter(pk=sample.pk).exists()
    with pytest.raises(LabConflictError):
        services.transition_batch(context.actor, batch.pk, "ship", {"tracking_number": "X"})
    _to_received(context, batch)
    assert batch_status(batch) == "received_by_lab"
    assert batch_summary(context.actor.organization) == {"in_process": 1, "pending_results": 1}
    services.apply_results(
        context.actor,
        batch.pk,
        [
            services.ResultRow(sample.pk, "wolbachia", "positive", "", Decimal("24.10")),
            services.ResultRow(sample.pk, "dengue", "positive", "DENV-2", None),
        ],
    )
    _tick(context)
    assert batch_status(batch) == "results_received"
    attempt = WolbachiaResultAttempt.objects.get(sample=sample)
    assert (attempt.status, attempt.result) == ("valid", "positive")
    dengue = PcrResult.objects.get(batch=batch, target="dengue")
    assert dengue.serotype == "DENV-2"
    assert dengue.wolbachia_attempt is None
    services.transition_batch(context.actor, batch.pk, "close", {})
    assert batch_status(batch) == "closed"
    detail = batch_detail(batch)
    assert [event["kind"] for event in detail["events"]] == [
        "ready",
        "ship",
        "receive",
        "results",
        "close",
    ]
    assert detail["samples"][0]["code"] == sample.code


@pytest.mark.django_db
def test_invalid_wolbachia_is_repeated_and_valid_is_locked(pcr):
    context, sample, lab = pcr
    batch = _batch(context, sample, lab, targets=("wolbachia",))
    _to_received(context, batch)
    services.apply_results(
        context.actor, batch.pk, [services.ResultRow(sample.pk, "wolbachia", "invalid")]
    )
    _tick(context)
    services.apply_results(
        context.actor, batch.pk, [services.ResultRow(sample.pk, "wolbachia", "negative")]
    )
    _tick(context)
    attempts = list(WolbachiaResultAttempt.objects.filter(sample=sample).order_by("revision"))
    assert [(row.status, row.result) for row in attempts] == [
        ("invalid", None),
        ("valid", "negative"),
    ]
    assert attempts[1].repeat_of_id == attempts[0].pk
    current = PcrResult.objects.get(batch=batch, superseded_by__isnull=True)
    with pytest.raises(LabConflictError):
        services.void_result(
            context.actor, batch.pk, current.pk, "Error de captura del laboratorio"
        )
    with pytest.raises(LabConflictError):
        services.apply_results(
            context.actor, batch.pk, [services.ResultRow(sample.pk, "wolbachia", "positive")]
        )


@pytest.mark.django_db
def test_dengue_void_then_correct_and_undo_void_rules(pcr):
    context, sample, lab = pcr
    batch = _batch(context, sample, lab, targets=("dengue",))
    services.transition_batch(context.actor, batch.pk, "ready", {})
    _tick(context)
    services.undo_last_step(context.actor, batch.pk, "Faltaba una muestra por revisar")
    _tick(context)
    assert batch_status(batch) == "preparing"
    _to_received(context, batch)
    services.apply_results(
        context.actor, batch.pk, [services.ResultRow(sample.pk, "dengue", "negative")]
    )
    _tick(context)
    with pytest.raises(LabConflictError):
        services.void_batch(context.actor, batch.pk, "Prueba registrada por error")
    result = PcrResult.objects.get(batch=batch)
    services.void_result(context.actor, batch.pk, result.pk, "El laboratorio corrigió el informe")
    _tick(context)
    services.apply_results(
        context.actor, batch.pk, [services.ResultRow(sample.pk, "dengue", "positive", "DENV-1")]
    )
    detail = batch_detail(batch)
    assert [row["current"] for row in detail["results"]] == [False, True]
    assert detail["results"][0]["voided"] is True


@pytest.mark.django_db
def test_csv_preview_reports_row_errors_without_writing(pcr):
    context, sample, lab = pcr
    batch = _batch(context, sample, lab)
    _to_received(context, batch)
    assert template_csv(batch).splitlines()[0] == "muestra,objetivo,resultado,serotipo,ct"
    content = (
        "muestra;objetivo;resultado;serotipo;ct\n"
        f"{sample.code};Wolbachia;Positivo;;23,5\n"
        f"{sample.code};dengue;negativo;DENV-2;\n"
        "NO-EXISTE;dengue;positivo;DENV-9;99\n"
    )
    preview = preview_csv(context.actor, batch, content)
    assert preview["valid_count"] == 1
    assert preview["error_count"] == 2
    assert preview["rows"][0]["ct_value"] == "23.50"
    codes = {error["code"] for row in preview["rows"] for error in row["errors"]}
    assert {"pcr_serotype_not_allowed", "pcr_sample_not_in_batch", "pcr_serotype_invalid"} <= codes
    assert not PcrResult.objects.exists()
    assert preview_csv(context.actor, batch, "a,b\n1,2\n")["file_error"] == "pcr_csv_header"


@pytest.mark.django_db
def test_other_organization_cannot_see_or_use_batch(pcr):
    context, sample, lab = pcr
    batch = _batch(context, sample, lab)
    other = Organization.objects.create(name="Otra", slug="otra-pcr")
    outsider = UploadActor(context.actor.user, other)
    with pytest.raises(Http404):
        services.transition_batch(outsider, batch.pk, "ready", {})
    with pytest.raises(FieldValidationError):
        services.create_batch(
            outsider, {"external_lab_id": lab.pk, "targets": ["dengue"], "sample_ids": [sample.pk]}
        )
    assert not PcrBatch.objects.filter(organization=other).exists()


@pytest.mark.django_db
def test_pcr_facts_are_insert_only_in_sql(pcr):
    context, sample, lab = pcr
    batch = _batch(context, sample, lab)
    with pytest.raises(Exception, match="insert-only"), connection.cursor() as cursor:
        cursor.execute("UPDATE lab_pcrbatch SET notes='x' WHERE id=%s", [batch.pk])
