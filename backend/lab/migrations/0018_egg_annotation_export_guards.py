"""New, empty job tables retain immutable selections and serialized state transitions."""

from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

FORWARD_SQL = r"""
SET LOCAL lock_timeout = '2s';
ALTER TABLE lab_eggannotationexportitem ADD CONSTRAINT annotation_export_item_org_fk
  FOREIGN KEY(organization_id,export_id) REFERENCES lab_eggannotationexport(organization_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE lab_eggannotationexportitem ADD CONSTRAINT annotation_export_annotation_org_fk
  FOREIGN KEY(organization_id,annotation_id) REFERENCES lab_eggannotation(organization_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE lab_eggannotationexportstatus ADD CONSTRAINT annotation_export_status_org_fk
  FOREIGN KEY(organization_id,export_id) REFERENCES lab_eggannotationexport(organization_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE lab_eggannotationexportdownload ADD CONSTRAINT annotation_export_download_org_fk
  FOREIGN KEY(organization_id,export_id) REFERENCES lab_eggannotationexport(organization_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER annotation_export_immutable BEFORE UPDATE OR DELETE ON lab_eggannotationexport
  FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();
CREATE TRIGGER annotation_export_item_immutable BEFORE UPDATE OR DELETE ON lab_eggannotationexportitem
  FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();
CREATE TRIGGER annotation_export_status_immutable BEFORE UPDATE OR DELETE ON lab_eggannotationexportstatus
  FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();
CREATE TRIGGER annotation_export_download_immutable BEFORE UPDATE OR DELETE ON lab_eggannotationexportdownload
  FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();
CREATE FUNCTION annotation_export_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.date_to - NEW.date_from > 365 OR NOT EXISTS (
    SELECT 1 FROM organizations_membership WHERE organization_id=NEW.organization_id AND user_id=NEW.created_by_id
  ) OR (NEW.author_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organizations_membership WHERE organization_id=NEW.organization_id AND user_id=NEW.author_id
  )) THEN RAISE EXCEPTION 'Invalid annotation export request' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER annotation_export_request BEFORE INSERT ON lab_eggannotationexport
  FOR EACH ROW EXECUTE FUNCTION annotation_export_request_guard();
CREATE FUNCTION annotation_export_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM lab_eggannotationexport WHERE id=NEW.export_id FOR NO KEY UPDATE;
  IF EXISTS (SELECT 1 FROM lab_eggannotationexportstatus WHERE export_id=NEW.export_id) THEN
    RAISE EXCEPTION 'Annotation export selection is sealed' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER annotation_export_item BEFORE INSERT ON lab_eggannotationexportitem
  FOR EACH ROW EXECUTE FUNCTION annotation_export_item_guard();
CREATE FUNCTION annotation_export_status_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_revision integer; images bigint; boxes bigint; points bigint;
BEGIN
  PERFORM 1 FROM lab_eggannotationexport WHERE id=NEW.export_id FOR NO KEY UPDATE;
  SELECT max(revision) INTO previous_revision FROM lab_eggannotationexportstatus WHERE export_id=NEW.export_id;
  IF NEW.revision <> coalesce(previous_revision+1,0)
    OR (NEW.status='queued' AND NEW.revision<>0)
    OR (NEW.status='running' AND NEW.revision<>1)
    OR (NEW.status IN ('ready','failed') AND NEW.revision<>2) THEN
    RAISE EXCEPTION 'Invalid annotation export transition' USING ERRCODE='23514';
  END IF;
  SELECT count(*),coalesce(sum(a.box_count),0),coalesce(sum(a.point_count),0) INTO images,boxes,points
    FROM lab_eggannotationexportitem item JOIN lab_eggannotation a ON a.id=item.annotation_id
    WHERE item.export_id=NEW.export_id;
  IF images>5000 OR (NEW.status='ready' AND (
    NEW.image_count<>images OR NEW.box_count<>boxes OR NEW.point_count<>points
    OR NEW.sha256 !~ '^[0-9a-f]{64}$' OR NEW.object_key !~ '^dataset/[0-9a-f]{32}\.zip$'
  )) THEN RAISE EXCEPTION 'Invalid annotation export result' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER annotation_export_status BEFORE INSERT ON lab_eggannotationexportstatus
  FOR EACH ROW EXECUTE FUNCTION annotation_export_status_guard();
CREATE FUNCTION annotation_export_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lab_eggannotationexportstatus WHERE export_id=NEW.id AND status='queued') THEN
    RAISE EXCEPTION 'Annotation export requires queued fact' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER annotation_export_complete AFTER INSERT ON lab_eggannotationexport
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION annotation_export_complete_guard();
"""

REVERSE_SQL = """
SET LOCAL lock_timeout = '2s';
DROP TRIGGER annotation_export_complete ON lab_eggannotationexport;
DROP FUNCTION annotation_export_complete_guard();
DROP TRIGGER annotation_export_status ON lab_eggannotationexportstatus;
DROP FUNCTION annotation_export_status_guard();
DROP TRIGGER annotation_export_item ON lab_eggannotationexportitem;
DROP FUNCTION annotation_export_item_guard();
DROP TRIGGER annotation_export_request ON lab_eggannotationexport;
DROP FUNCTION annotation_export_request_guard();
DROP TRIGGER annotation_export_download_immutable ON lab_eggannotationexportdownload;
DROP TRIGGER annotation_export_status_immutable ON lab_eggannotationexportstatus;
DROP TRIGGER annotation_export_item_immutable ON lab_eggannotationexportitem;
DROP TRIGGER annotation_export_immutable ON lab_eggannotationexport;
ALTER TABLE lab_eggannotationexportdownload DROP CONSTRAINT annotation_export_download_org_fk;
ALTER TABLE lab_eggannotationexportstatus DROP CONSTRAINT annotation_export_status_org_fk;
ALTER TABLE lab_eggannotationexportitem DROP CONSTRAINT annotation_export_annotation_org_fk;
ALTER TABLE lab_eggannotationexportitem DROP CONSTRAINT annotation_export_item_org_fk;
"""


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    if apps.get_model("lab", "EggAnnotationExport").objects.exists():
        raise IrreversibleError(
            "Retain immutable annotation dataset exports and download receipts."
        )


class Migration(migrations.Migration):
    dependencies = [("lab", "0017_egg_annotation_exports")]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
