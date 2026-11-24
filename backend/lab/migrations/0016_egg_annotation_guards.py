"""Retained image/count identity and complete immutable parent linkage."""

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

FORWARD_SQL = r"""
SET LOCAL lock_timeout = '2s';
ALTER TABLE lab_eggannotation ADD CONSTRAINT egg_annotation_bag_org_fk
  FOREIGN KEY(organization_id,bag_id) REFERENCES ovitraps_bag(organization_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE lab_eggannotation ADD CONSTRAINT egg_annotation_count_org_fk
  FOREIGN KEY(organization_id,count_id) REFERENCES lab_eggcountattempt(organization_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER egg_annotation_immutable BEFORE UPDATE OR DELETE ON lab_eggannotation
  FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();
CREATE FUNCTION egg_annotation_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mark jsonb; coordinate text; boxes integer := 0; points integer := 0;
BEGIN
  IF jsonb_typeof(NEW.marks) <> 'array' OR jsonb_array_length(NEW.marks)>5000 THEN
    RAISE EXCEPTION 'Invalid annotation marks' USING ERRCODE='23514';
  END IF;
  FOR mark IN SELECT value FROM jsonb_array_elements(NEW.marks) LOOP
    IF jsonb_typeof(mark)<>'object' OR mark->>'kind' IS NULL OR mark->>'kind' NOT IN ('box','point') OR NOT(mark ?& ARRAY['kind','x','y']) THEN
      RAISE EXCEPTION 'Invalid annotation mark kind' USING ERRCODE='23514';
    END IF;
    IF (mark->>'kind'='box' AND ((SELECT count(*) FROM jsonb_object_keys(mark))<>5 OR NOT(mark ?& ARRAY['w','h'])))
      OR (mark->>'kind'='point' AND (SELECT count(*) FROM jsonb_object_keys(mark))<>3) THEN
      RAISE EXCEPTION 'Invalid annotation mark fields' USING ERRCODE='23514';
    END IF;
    FOREACH coordinate IN ARRAY CASE WHEN mark->>'kind'='box' THEN ARRAY['x','y','w','h'] ELSE ARRAY['x','y'] END LOOP
      IF NOT(mark ? coordinate) OR jsonb_typeof(mark->coordinate)<>'number' OR (mark->>coordinate)!~'^[0-9]+$' THEN
        RAISE EXCEPTION 'Annotation coordinates must be integers' USING ERRCODE='23514';
      END IF;
    END LOOP;
    IF (mark->>'x')::numeric>=NEW.image_width OR (mark->>'y')::numeric>=NEW.image_height THEN
      RAISE EXCEPTION 'Annotation coordinate outside image' USING ERRCODE='23514';
    END IF;
    IF mark->>'kind'='box' THEN
      IF (mark->>'w')::numeric<1 OR (mark->>'h')::numeric<1
        OR (mark->>'x')::numeric+(mark->>'w')::numeric>NEW.image_width
        OR (mark->>'y')::numeric+(mark->>'h')::numeric>NEW.image_height THEN
        RAISE EXCEPTION 'Annotation box outside image' USING ERRCODE='23514';
      END IF;
      boxes := boxes+1;
    ELSE points := points+1;
    END IF;
  END LOOP;
  IF boxes<>NEW.box_count OR points<>NEW.point_count OR NOT EXISTS(
    SELECT 1 FROM lab_eggcountattempt count
      JOIN uploads_upload upload ON upload.id=NEW.image_upload_id
      JOIN uploads_uploadverification verified ON verified.upload_id=upload.id
    WHERE count.id=NEW.count_id AND count.organization_id=NEW.organization_id
      AND count.bag_id=NEW.bag_id AND count.created_by_id=NEW.created_by_id
      AND count.value=boxes+points AND upload.organization_id=NEW.organization_id
      AND upload.uploader_id=NEW.created_by_id AND verified.organization_id=NEW.organization_id
      AND verified.width=NEW.image_width AND verified.height=NEW.image_height
      AND verified.content_type IN ('image/jpeg','image/png','image/webp')
      AND (verified.content_type<>'image/webp' OR upload.purpose='egg_annotation')
  ) THEN RAISE EXCEPTION 'Annotation requires its exact count and verified image' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER egg_annotation_insert BEFORE INSERT ON lab_eggannotation
  FOR EACH ROW EXECUTE FUNCTION egg_annotation_insert_guard();
CREATE FUNCTION egg_annotation_attachment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.egg_annotation_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM lab_eggannotation annotation
    WHERE annotation.id=NEW.egg_annotation_id AND annotation.organization_id=NEW.organization_id
      AND annotation.image_upload_id=NEW.upload_id AND annotation.created_by_id=NEW.created_by_id
  ) THEN RAISE EXCEPTION 'Annotation parent requires its exact verified upload' USING ERRCODE='23514';
  END IF;
  IF NEW.egg_annotation_id IS NULL AND EXISTS(SELECT 1 FROM uploads_upload upload
    WHERE upload.id=NEW.upload_id AND upload.purpose='egg_annotation') THEN
    RAISE EXCEPTION 'Annotation uploads cannot be bound to another parent' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER egg_annotation_attachment BEFORE INSERT ON uploads_attachmentlink
  FOR EACH ROW EXECUTE FUNCTION egg_annotation_attachment_guard();
CREATE FUNCTION egg_annotation_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM uploads_attachmentlink link WHERE link.egg_annotation_id=NEW.id
    AND link.upload_id=NEW.image_upload_id AND link.organization_id=NEW.organization_id) THEN
    RAISE EXCEPTION 'Annotation requires retained attachment linkage' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER egg_annotation_complete AFTER INSERT ON lab_eggannotation
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION egg_annotation_complete_guard();
"""
REVERSE_SQL = """
SET LOCAL lock_timeout = '2s';
DROP TRIGGER egg_annotation_complete ON lab_eggannotation;
DROP FUNCTION egg_annotation_complete_guard();
DROP TRIGGER egg_annotation_attachment ON uploads_attachmentlink;
DROP FUNCTION egg_annotation_attachment_guard();
DROP TRIGGER egg_annotation_insert ON lab_eggannotation;
DROP FUNCTION egg_annotation_insert_guard();
DROP TRIGGER egg_annotation_immutable ON lab_eggannotation;
ALTER TABLE lab_eggannotation DROP CONSTRAINT egg_annotation_count_org_fk;
ALTER TABLE lab_eggannotation DROP CONSTRAINT egg_annotation_bag_org_fk;
"""


def protect_reverse(apps, schema_editor):
    if apps.get_model("lab", "EggAnnotation").objects.exists():
        raise IrreversibleError("Retain immutable egg annotations and their integrity guards.")


class Migration(migrations.Migration):
    dependencies = [("lab", "0015_egg_annotations"), ("uploads", "0012_egg_annotations")]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
