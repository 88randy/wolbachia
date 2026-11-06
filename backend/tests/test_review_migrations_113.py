"""Real PostgreSQL upgrade, raw guards and downgrade protection; never SQLite substitutes."""

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.migrations.exceptions import IrreversibleError
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_reviews_upgrade_preserves_legacy_source_and_binding_and_guards_new_audit(
    org_a, make_member, monkeypatch
):
    from field_sync.models import FieldEvent
    from reviews.models import ReviewDecision, ReviewSourceSnapshot
    from tests.factories import FieldEventFactory
    from tests.review_support import reviewed_open
    from tests.uploads_support import verified_upload
    from uploads.models import AttachmentLink

    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *_args: None)
    legacy = FieldEventFactory(organization=org_a, status="in_review", status_code="clock_skew")
    upload = verified_upload(org_a, legacy.created_by, device=legacy.device)
    binding = AttachmentLink.objects.create(
        organization=org_a, created_by=legacy.created_by, upload=upload, field_event=legacy
    )
    original = (
        legacy.payload,
        legacy.payload_sha256,
        legacy.status,
        legacy.status_code,
        legacy.device_time,
        legacy.server_received_at,
        binding.pk,
        binding.upload_id,
    )
    executor = MigrationExecutor(connection)
    leaves = executor.loader.graph.leaf_nodes()
    previous = [("reviews", "0001_initial"), ("uploads", "0002_incident_attachment_parent")]
    try:
        executor.migrate(previous)
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT field_event_id, upload_id FROM uploads_attachmentlink WHERE id=%s",
                [binding.pk],
            )
            assert cursor.fetchone() == (legacy.pk, upload.pk)
        executor = MigrationExecutor(connection)
        executor.migrate(leaves)
        legacy.refresh_from_db()
        binding.refresh_from_db()
        assert original == (
            legacy.payload,
            legacy.payload_sha256,
            legacy.status,
            legacy.status_code,
            legacy.device_time,
            legacy.server_received_at,
            binding.pk,
            binding.upload_id,
        )
        assert binding.review_item_id is None
        assert not ReviewSourceSnapshot.objects.filter(source_event=legacy).exists()
        _phone, _motorcycle, item, _capture = reviewed_open(org_a, make_member)
        source = item.field_event
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                "UPDATE reviews_reviewsourcesnapshot SET facts='{}'::jsonb WHERE source_event_id=%s",
                [source.pk],
            )
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM reviews_reviewsourcesnapshot WHERE source_event_id=%s", [source.pk]
            )
        with pytest.raises(DatabaseError), transaction.atomic():  # noqa: PT012 -- insert and bounded deferred flush exercise the same SQL constraint
            ReviewDecision.objects.create(
                organization=org_a,
                created_by=item.courier,
                review_item=item,
                kind="void",
                is_terminal=True,
                revision=1,
                expected_revision=0,
                reason="A raw generic void cannot clear an unresolved severe hold",
            )
            connection.check_constraints()
        assert not ReviewDecision.objects.filter(review_item=item).exists()
        with pytest.raises(IrreversibleError):
            MigrationExecutor(connection).migrate(previous)
        assert FieldEvent.objects.filter(pk=source.pk, status="in_review").exists()
        assert ReviewSourceSnapshot.objects.filter(source_event=source).exists()
    finally:
        MigrationExecutor(connection).migrate(leaves)
