"""One real legacy upgrade and raw source-chain guard owner; PostgreSQL CI only."""

from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.migrations.exceptions import IrreversibleError
from django.db.migrations.executor import MigrationExecutor

from tests.people_support import (
    certify,
    evaluation_values,
    people_context,
    require_training,
    rubric_version,
    training_version,
    verified_training_evidence,
    write_person,
)

# Explicit #116 additions removed with People and restored through its dependents.
RELEASE_ADDITIVE_TRIGGERS = {
    f"releases_{table}_guard"
    for table in (
        "permit",
        "permittype",
        "permitversion",
        "permitsuspension",
        "permitsuspensionnotice",
        "releasedevice",
        "releasedevicestatus",
        "releaseschedule",
        "release",
    )
} | {
    "releases_release_source_guard",
    "inventory_release_stock_complete",
    "inventory_release_operation_guard",
    "inventory_release_operation_complete",
    "inventory_release_movement_complete",
}

# Explicit #118 guards restored through People's upload/release dependents.
SHIPMENT_ADDITIVE_TRIGGERS = {
    "inventory_material_delivery_complete",
    "inventory_material_delivery_movement_complete",
    "inventory_material_delivery_operation_complete",
    "inventory_material_delivery_operation_guard",
    "lab_deliveryreceipt_guard",
    "lab_materialrequest_guard",
    "lab_materialrequestvoid_guard",
    "lab_notificationevidence_guard",
    "lab_shipmentsource_complete_guard",
    "lab_shipmentsource_guard",
    "lab_shipmentsource_sample_guard",
    "lab_shipmentvoid_guard",
    "lab_uiebshipment_complete_guard",
    "lab_uiebshipment_guard",
    "lab_wolbachiasample_guard",
    "uploads_material_request_parent_guard",
}


def trigger_definitions():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger "
            "WHERE NOT tgisinternal ORDER BY tgname"
        )
        return dict(cursor.fetchall())


def copied_fields(row, **overrides):
    return {
        **{
            field.attname: getattr(row, field.attname)
            for field in row._meta.concrete_fields
            if field.name not in {"id", "created_at"}
        },
        **overrides,
    }


@pytest.mark.django_db(transaction=True)
def test_people_upgrade_retains_legacy_and_raw_guards_preserve_real_private_chains(
    org_a, org_b, make_member, monkeypatch, settings, tmp_path
):
    from accounts.models import DeviceSession, TokenPair
    from organizations.models import all_scope
    from people.models import (
        ActionTrainingRequirementVersion,
        Certification,
        CertificationRevocation,
        EligibilityAssessmentReceipt,
        Evaluation,
        EvaluationAttempt,
        EvaluationCompletion,
        EvaluationNoticePolicyVersion,
        EvaluationVoid,
        PeopleCommand,
        Training,
        TrainingNoticeCause,
        TrainingNoticeIntent,
        TrainingNoticePublication,
        TrainingNoticeRoute,
        TrainingVersion,
    )
    from people.notices import recover_notice
    from uploads.models import AttachmentLink, Upload

    context = people_context(org_a, make_member, monkeypatch, settings, tmp_path)
    session = DeviceSession.objects.get(device_id=context.phone.device_id)
    legacy_session = DeviceSession.objects.filter(pk=session.pk).values().get()
    legacy_pair = TokenPair.objects.filter(session=session).values().get()
    leaves = MigrationExecutor(connection).loader.graph.leaf_nodes()
    try:
        MigrationExecutor(connection).migrate([("people", None)])
        baseline = trigger_definitions()
        assert DeviceSession.objects.filter(pk=session.pk).values().get() == legacy_session
        assert TokenPair.objects.filter(pk=legacy_pair["id"]).values().get() == legacy_pair
        MigrationExecutor(connection).migrate(leaves)
        upgraded = trigger_definitions()
        assert {name: upgraded[name] for name in baseline} == baseline
        tables = (
            "training",
            "trainingversion",
            "actiontrainingrequirementversion",
            "certification",
            "certificationrevocation",
            "evaluationrubric",
            "evaluationrubricversion",
            "evaluation",
            "evaluationattempt",
            "evaluationvoid",
            "evaluationcompletion",
            "evaluationnoticepolicyversion",
            "trainingnoticecause",
            "trainingnoticeintent",
            "trainingnoticepublication",
            "trainingnoticeroute",
            "eligibilityassessmentreceipt",
            "peoplecommand",
        )
        additions = (
            {
                f"people_{table}_{suffix}"
                for table in tables
                for suffix in ("guard", "complete_guard")
            }
            | {"uploads_certification_parent_guard"}
            | RELEASE_ADDITIVE_TRIGGERS
            | SHIPMENT_ADDITIVE_TRIGGERS
        )
        assert set(upgraded) - set(baseline) == additions
        assert Training.objects.count() == Certification.objects.count() == 0
        assert EligibilityAssessmentReceipt.objects.count() == 0
        assert DeviceSession.objects.filter(pk=session.pk).values().get() == legacy_session

        version = training_version(context)
        require_training(context, version)
        receipt = certify(context, version)
        certificate = Certification.objects.get(pk=receipt["id"])
        attachment = AttachmentLink.objects.get(certification=certificate)
        assert attachment.upload.verification.pk
        assert attachment.upload.public_id == UUID(certificate.evidence_ids[0])
        # Genuine authenticated publication, never a forced-client flag or retroactive query.
        bootstrap = context.phone.client.get("/api/v1/field/bootstrap/")
        assert bootstrap.status_code == 200, bootstrap.data
        assessment = EligibilityAssessmentReceipt.objects.get(subject=context.phone.user)
        assert assessment.pair_id == legacy_pair["id"]
        assert assessment.assessment["training_eligible"] is True

        rubric = rubric_version(context)
        write_person(
            context,
            "notice_policy.version",
            {
                **context.context.lookups(),
                "recipient_membership_id": context.member.pk,
                "reroute_cause_ids": [],
            },
        )
        observations = [
            write_person(context, "evaluation.create", evaluation_values(context, rubric))
            for _ in range(3)
        ]
        cause = TrainingNoticeCause.objects.get(kind="third_adverse")
        assert recover_notice(cause.pk)
        _, another_member = make_member(org_a, ["evaluation.read"])
        another_member.scope = all_scope()
        another_member.save(update_fields=["scope"])
        another_profile = another_member.profiles.get()
        another_profile.scope = all_scope()
        another_profile.save(update_fields=["scope"])
        write_person(
            context,
            "notice_policy.version",
            {
                **context.context.lookups(),
                "expected_revision": 1,
                "recipient_membership_id": another_member.pk,
                "reroute_cause_ids": [cause.pk],
            },
        )
        route = TrainingNoticeRoute.objects.get(cause=cause)
        assert route.intent.recipient_membership_id == another_member.pk
        assert recover_notice(cause.pk)
        publication = cause.publications.latest("attempt_number")
        assert publication.status == "delivery_unavailable"
        assert set(publication.assessment) == {
            "status",
            "facts",
            "policies",
            "recipient_membership_id",
            "contexts",
        }
        assert publication.assessment["contexts"] == [context.context.payload()]
        assert len(publication.assessment["facts"]) == 3
        with pytest.raises(DatabaseError, match="publication mismatch"), transaction.atomic():
            TrainingNoticePublication.objects.create(
                **copied_fields(
                    publication,
                    attempt_number=publication.attempt_number + 1,
                    assessment=assessment.assessment,
                )
            )
        with (
            pytest.raises(DatabaseError, match="assessment context mismatch"),
            transaction.atomic(),
        ):
            EligibilityAssessmentReceipt.objects.create(
                **copied_fields(
                    assessment, semantic_hash="d" * 64, assessment=publication.assessment
                )
            )

        # A raw writer cannot mutate or delete any populated fact family.
        immutable = (
            Training.objects.first(),
            version,
            ActionTrainingRequirementVersion.objects.get(),
            certificate,
            rubric.rubric,
            rubric,
            Evaluation.objects.first(),
            EvaluationAttempt.objects.first(),
            EvaluationCompletion.objects.first(),
            EvaluationNoticePolicyVersion.objects.first(),
            cause,
            TrainingNoticeIntent.objects.first(),
            TrainingNoticePublication.objects.first(),
            route,
            assessment,
            PeopleCommand.objects.first(),
        )
        for row in immutable:
            with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
                cursor.execute(
                    f'UPDATE "{row._meta.db_table}" SET created_at=created_at WHERE id=%s',  # noqa: S608 -- closed real model instances above.
                    [row.pk],
                )
            with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
                cursor.execute(
                    f'DELETE FROM "{row._meta.db_table}" WHERE id=%s',  # noqa: S608 -- closed real model instances above.
                    [row.pk],
                )

        foreign_author, _ = make_member(org_b, ["training.manage"])
        with pytest.raises(DatabaseError, match="tenant"), transaction.atomic():
            TrainingVersion.objects.create(
                **copied_fields(
                    version, organization_id=org_b.pk, created_by_id=foreign_author.pk, version=2
                )
            )
        with pytest.raises(DatabaseError, match="command incomplete"), transaction.atomic():
            Training.objects.create(
                organization=org_a,
                created_by=context.actor.user,
                code="RAW-UNCOMMITTED",
                name="Raw fact without a genuine command",
            )
        command = PeopleCommand.objects.get(operation="certification.issue")
        identity = uuid4()
        with pytest.raises(DatabaseError, match="receipt mismatch"), transaction.atomic():
            PeopleCommand.objects.create(
                **copied_fields(
                    command,
                    command_id=identity,
                    response={**command.response, "command_id": str(identity)},
                )
            )
        incomplete = copied_fields(
            certificate,
            evidence_ids=[],
            issuer_reference="Raw missing private proof",
        )
        with pytest.raises(DatabaseError, match="proof mismatch"), transaction.atomic():
            Certification.objects.create(**incomplete)
        unrelated = verified_training_evidence(context)
        with pytest.raises(DatabaseError, match="certification evidence"), transaction.atomic():
            AttachmentLink.objects.create(
                **copied_fields(attachment, upload_id=Upload.objects.get(public_id=unrelated).pk)
            )

        observed = EvaluationAttempt.objects.get(pk=observations[0]["evaluation"]["attempt_id"])
        with pytest.raises(DatabaseError, match="score mismatch"), transaction.atomic():
            EvaluationAttempt.objects.create(
                **copied_fields(
                    observed,
                    predecessor_id=observed.pk,
                    revision=2,
                    score="99",
                    reason_code="other",
                    reason="Raw forged score differs from retained observations",
                )
            )
        with pytest.raises(DatabaseError, match="sequence mismatch"), transaction.atomic():  # noqa: PT012 -- genuine attempt and rejected completion share rollback.
            forged_attempt = EvaluationAttempt.objects.create(
                **copied_fields(
                    observed,
                    predecessor_id=observed.pk,
                    revision=2,
                    reason_code="other",
                    reason="Raw completion may not skip the retained person sequence",
                )
            )
            EvaluationCompletion.objects.create(
                organization=org_a,
                created_by=context.actor.user,
                subject=context.phone.user,
                sequence=5,
                attempt=forged_attempt,
            )
        completion = EvaluationCompletion.objects.order_by("sequence").first()
        with pytest.raises(DatabaseError, match="third-adverse cause"), transaction.atomic():
            TrainingNoticeCause.objects.create(
                organization=org_a,
                created_by=context.actor.user,
                actor_kind="human",
                subject=context.phone.user,
                kind="third_adverse",
                episode_start=completion,
                completion=completion,
                due_at=completion.created_at,
                contexts=[context.context.payload()],
                policy_ids=[],
            )
        with pytest.raises(DatabaseError, match="publication mismatch"), transaction.atomic():
            TrainingNoticePublication.objects.create(
                **copied_fields(
                    TrainingNoticePublication.objects.first(),
                    attempt_number=publication.attempt_number + 1,
                    status="delivered",
                    not_published=False,
                )
            )
        with (
            pytest.raises(DatabaseError, match="assessment context mismatch"),
            transaction.atomic(),
        ):
            EligibilityAssessmentReceipt.objects.create(
                **copied_fields(
                    assessment,
                    subject_id=context.actor.user.pk,
                    semantic_hash="b" * 64,
                )
            )
        with pytest.raises(DatabaseError, match="publication incomplete"), transaction.atomic():
            EligibilityAssessmentReceipt.objects.create(
                **copied_fields(
                    assessment,
                    semantic_hash="c" * 64,
                    publication_sequence=assessment.publication_sequence + 999,
                )
            )

        write_person(
            context,
            "certification.revoke",
            {
                "expected_revision": 1,
                "effective_from": context.clock["now"] + timedelta(hours=1),
                "reason_code": "other",
                "reason": "Retain the genuine evidence-backed certificate history",
            },
            target=certificate.pk,
        )
        write_person(
            context,
            "evaluation.void",
            {
                "expected_revision": 1,
                "expected_completion_sequence": 3,
                "reason_code": "other",
                "reason": "Retain every raw-guard fixture completion and source",
            },
            target=UUID(observations[0]["id"]),
        )
        assert CertificationRevocation.objects.count() == EvaluationVoid.objects.count() == 1
        retained = Certification.objects.filter(pk=certificate.pk).values().get()
        executor = MigrationExecutor(connection)
        applied = set(executor.recorder.applied_migrations())
        # Keep the refused multi-migration downgrade and dependent DDL in one rollback.
        with pytest.raises(IrreversibleError), transaction.atomic():
            executor.migrate([("people", "0001_people_certification_parent")])
        assert set(executor.recorder.applied_migrations()) == applied
        assert Certification.objects.filter(pk=certificate.pk).values().get() == retained
        assert AttachmentLink.objects.get(pk=attachment.pk).certification_id == certificate.pk
        assert (
            EligibilityAssessmentReceipt.objects.get(pk=assessment.pk).subject_id
            == context.phone.user.pk
        )
    finally:
        MigrationExecutor(connection).migrate(leaves)
