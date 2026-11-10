"""Append-only tenant/lineage guards and deferred proof of the actual source event."""

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

CHECKS = {
    "permit": """EXISTS (
        SELECT 1 FROM geography_quadrant q
        JOIN organizations_center c ON c.id=q.center_id
        WHERE q.id=NEW.quadrant_id AND q.organization_id=NEW.organization_id
          AND c.id=NEW.center_id AND c.organization_id=NEW.organization_id)""",
    "permittype": """jsonb_typeof(NEW.requirements)='object'
        AND NEW.requirements - 'max_gps_accuracy_m'='{}'::jsonb
        AND jsonb_typeof(NEW.requirements->'max_gps_accuracy_m')='number'
        AND (NEW.requirements->>'max_gps_accuracy_m')::numeric>0""",
    "permitversion": """EXISTS (
        SELECT 1 FROM releases_permit p
        JOIN releases_permittype t ON t.id=NEW.type_id
        JOIN uploads_uploadverification v ON v.id=NEW.official_document_id
        JOIN uploads_upload u ON u.id=v.upload_id
        JOIN uploads_uploadsource s ON s.id=v.source_id AND s.upload_id=u.id
        WHERE p.id=NEW.permit_id AND p.organization_id=NEW.organization_id
          AND t.organization_id=NEW.organization_id AND v.organization_id=NEW.organization_id
          AND u.organization_id=NEW.organization_id AND s.organization_id=NEW.organization_id
          AND u.uploader_id=NEW.created_by_id
          AND NOT EXISTS(SELECT 1 FROM uploads_attachmentlink l WHERE l.upload_id=u.id))
        AND NEW.revision=(SELECT COALESCE(MAX(v.revision),0)+1 FROM releases_permitversion v WHERE v.permit_id=NEW.permit_id)
        AND NOT EXISTS(SELECT 1 FROM releases_permitsuspension s WHERE s.permit_id=NEW.permit_id)
        AND jsonb_typeof(NEW.geometry)='object' AND NEW.geometry->>'type'='Polygon'
        AND length(regexp_replace(NEW.document_attestation,'[[:space:]]','','g'))>=10
        AND length(NEW.document_attestation)<=1000""",
    "permitsuspension": """EXISTS (
        SELECT 1 FROM releases_permit p WHERE p.id=NEW.permit_id AND p.organization_id=NEW.organization_id)
        AND NEW.revision=(SELECT COALESCE(MAX(v.revision),0)+1 FROM releases_permitversion v WHERE v.permit_id=NEW.permit_id)
        AND length(regexp_replace(NEW.reason,'[[:space:]]','','g'))>=10 AND length(NEW.reason)<=1000""",
    "permitsuspensionnotice": """EXISTS (
        SELECT 1 FROM releases_permitsuspension s
        JOIN organizations_membership m ON m.id=NEW.recipient_id
        WHERE s.id=NEW.suspension_id AND s.organization_id=NEW.organization_id
          AND m.organization_id=NEW.organization_id)
        AND jsonb_typeof(NEW.scope_snapshot)='object'""",
    "releasedevice": """EXISTS (
        SELECT 1 FROM geography_quadrant q
        JOIN organizations_center c ON c.id=q.center_id
        JOIN inventory_lot l ON l.id=NEW.source_lot_id
        JOIN inventory_lotversion v ON v.id=NEW.source_lot_version_id AND v.lot_id=l.id
        JOIN inventory_supplytypeversion s ON s.id=v.supply_version_id
        WHERE q.id=NEW.quadrant_id AND q.organization_id=NEW.organization_id
          AND c.id=NEW.center_id AND c.organization_id=NEW.organization_id
          AND l.organization_id=NEW.organization_id AND l.center_id=c.id AND l.quadrant_id=q.id
          AND v.organization_id=NEW.organization_id AND s.organization_id=NEW.organization_id AND s.is_biological)""",
    "releaseschedule": """EXISTS (
        SELECT 1 FROM scheduling_scheduledtask t
        JOIN geography_samplingpoint point ON point.id=t.point_id
        JOIN geography_block block ON block.id=point.block_id
        JOIN releases_permitversion v ON v.id=NEW.permit_version_id
        JOIN releases_permit p ON p.id=v.permit_id
        WHERE t.id=NEW.task_id AND t.organization_id=NEW.organization_id AND t.action='release'
          AND point.organization_id=NEW.organization_id AND block.organization_id=NEW.organization_id
          AND v.organization_id=NEW.organization_id AND p.organization_id=NEW.organization_id
          AND p.quadrant_id=block.quadrant_id)""",
    "release": """EXISTS (
        SELECT 1 FROM releases_permitversion v
        JOIN releases_permit p ON p.id=v.permit_id
        JOIN releases_releasedevice d ON d.id=NEW.release_device_id
        JOIN inventory_lot l ON l.id=NEW.lot_id
        JOIN people_trainingversion training ON training.id=NEW.training_version_id
        JOIN scheduling_scheduledtask t ON t.id=NEW.schedule_task_id
        JOIN releases_releaseschedule plan ON plan.task_id=t.id
        JOIN releases_permitversion planned ON planned.id=plan.permit_version_id
        WHERE v.id=NEW.permit_version_id AND v.organization_id=NEW.organization_id
          AND p.organization_id=NEW.organization_id AND d.organization_id=NEW.organization_id
          AND l.organization_id=NEW.organization_id AND training.organization_id=NEW.organization_id
          AND t.organization_id=NEW.organization_id AND plan.organization_id=NEW.organization_id
          AND planned.organization_id=NEW.organization_id AND planned.permit_id=p.id
          AND d.source_lot_id=l.id AND d.center_id=p.center_id AND d.quadrant_id=p.quadrant_id
          AND l.center_id=p.center_id AND l.quadrant_id=p.quadrant_id AND t.action='release')
        AND jsonb_typeof(NEW.location)='array' AND jsonb_array_length(NEW.location)=2
        AND jsonb_typeof(NEW.provenance)='object'""",
}


def table_guard(table: str, check: str) -> str:
    return f"""
CREATE FUNCTION releases_{table}_validate() RETURNS trigger AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'release facts are insert-only'; END IF;
 IF NEW.created_by_id IS NULL OR NOT COALESCE(({check}),false)
 THEN RAISE EXCEPTION 'invalid release tenant or lineage'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER releases_{table}_guard BEFORE INSERT OR UPDATE OR DELETE ON releases_{table}
FOR EACH ROW EXECUTE FUNCTION releases_{table}_validate();
"""


SOURCE_SQL = """
CREATE FUNCTION releases_source_validate() RETURNS trigger AS $$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM field_sync_fieldevent e
    JOIN releases_permitversion v ON v.id=NEW.permit_version_id
    WHERE e.id=NEW.declared_event_id AND e.organization_id=NEW.organization_id
      AND e.created_by_id=NEW.created_by_id AND e.type='release.record' AND e.schema_version=1
      AND e.device_time=NEW.device_time AND e.server_received_at=NEW.server_received_at
      AND e.payload->>'permit_id'=v.permit_id::text
      AND e.payload->>'release_device_id'=NEW.release_device_id::text
      AND e.payload->>'lot_id'=NEW.lot_id::text
      AND e.payload->>'training_version'=NEW.training_version_id::text
      AND e.payload->>'schedule_task_id'=NEW.schedule_task_id::text
      AND (e.payload->>'quantity')::numeric=NEW.quantity
      AND e.payload_sha256=NEW.provenance->>'source_payload_hash'
      AND e.gps_lng=(NEW.location->>0)::double precision
      AND e.gps_lat=(NEW.location->>1)::double precision
      AND (e.status='accepted' OR (e.status='in_review' AND EXISTS (
          SELECT 1 FROM reviews_revieweffectreceipt receipt
          JOIN reviews_reviewdecision decision ON decision.id=receipt.decision_id
          JOIN reviews_reviewitem item ON item.id=decision.review_item_id
          WHERE receipt.source_event_id=e.id AND receipt.organization_id=e.organization_id
            AND receipt.payload_sha256=e.payload_sha256 AND receipt.mode='applied_review'
            AND decision.kind='accept' AND decision.is_terminal
            AND decision.organization_id=e.organization_id AND item.field_event_id=e.id
            AND item.organization_id=e.organization_id))))
 THEN RAISE EXCEPTION 'release requires its actual accepted source'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER releases_release_source_guard AFTER INSERT ON releases_release
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION releases_source_validate();
"""

FORWARD_SQL = "\n".join(table_guard(table, check) for table, check in CHECKS.items()) + SOURCE_SQL
REVERSE_SQL = """
DROP TRIGGER releases_release_source_guard ON releases_release;
DROP FUNCTION releases_source_validate();
""" + "\n".join(
    f"DROP TRIGGER releases_{table}_guard ON releases_{table}; DROP FUNCTION releases_{table}_validate();"
    for table in reversed(CHECKS)
)


def refuse_populated_reverse(apps, schema_editor):
    for model in apps.get_app_config("releases").get_models():
        if model.objects.using(schema_editor.connection.alias).exists():
            raise IrreversibleError("Release authority and provenance must be retained.")


class Migration(migrations.Migration):
    dependencies = [
        ("releases", "0001_initial"),
        ("reviews", "0005_supply_source_dependency"),
        ("scheduling", "0003_release_task_action"),
    ]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(migrations.RunPython.noop, refuse_populated_reverse),
    ]
