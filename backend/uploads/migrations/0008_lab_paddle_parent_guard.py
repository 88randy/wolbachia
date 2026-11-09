"""The eighth typed parent follows verified-unbound Lab evidence, never a second upload path."""

from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

FORWARD = r"""
CREATE FUNCTION uploads_lab_paddle_parent_guard() RETURNS trigger AS $$
BEGIN
 IF NEW.lab_paddle_command_id IS NOT NULL THEN
   IF NOT COALESCE(EXISTS(SELECT 1 FROM lab_labcommand command JOIN uploads_upload upload ON upload.id=NEW.upload_id
     WHERE command.id=NEW.lab_paddle_command_id AND command.organization_id=NEW.organization_id AND upload.organization_id=NEW.organization_id
     AND command.created_by_id=NEW.created_by_id AND upload.uploader_id=NEW.created_by_id
     AND command.action IN ('paddle_register','paddle_bind','paddle_reuse')
     AND jsonb_typeof(command.canonical_input->'evidence_ids')='array'
     AND (command.canonical_input->'evidence_ids') ? upload.public_id::text
     AND ((command.action='paddle_register' AND EXISTS(SELECT 1 FROM lab_eggpaddle fact WHERE fact.command_id=command.id AND fact.piece_id=command.target_id AND fact.created_by_id=command.created_by_id AND fact.evidence_ids=command.canonical_input->'evidence_ids'))
       OR (command.action='paddle_bind' AND EXISTS(SELECT 1 FROM lab_paddlebagbinding fact WHERE fact.command_id=command.id AND fact.paddle_id=command.target_id AND fact.created_by_id=command.created_by_id AND fact.evidence_ids=command.canonical_input->'evidence_ids'))
       OR (command.action='paddle_reuse' AND EXISTS(SELECT 1 FROM lab_paddlereuse fact JOIN lab_paddlebagbinding binding ON binding.id=fact.binding_id WHERE fact.command_id=command.id AND binding.paddle_id=command.target_id AND fact.created_by_id=command.created_by_id AND fact.evidence_ids=command.canonical_input->'evidence_ids')))),false)
     THEN RAISE EXCEPTION 'Paddle parent requires its exact declared genuine operational fact'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER uploads_lab_paddle_parent_guard BEFORE INSERT ON uploads_attachmentlink
FOR EACH ROW EXECUTE FUNCTION uploads_lab_paddle_parent_guard();

CREATE FUNCTION uploads_lab_paddle_parent_complete() RETURNS trigger AS $$
BEGIN
 IF NEW.lab_paddle_command_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM lab_labcommandresult WHERE command_id=NEW.lab_paddle_command_id AND status=201)
     OR NOT EXISTS(SELECT 1 FROM uploads_uploadverification WHERE upload_id=NEW.upload_id)
     THEN RAISE EXCEPTION 'Paddle consumption requires its completed genuine command and verified evidence'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER uploads_lab_paddle_parent_complete AFTER INSERT ON uploads_attachmentlink
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION uploads_lab_paddle_parent_complete();
"""
REVERSE = """
DROP TRIGGER uploads_lab_paddle_parent_complete ON uploads_attachmentlink;
DROP TRIGGER uploads_lab_paddle_parent_guard ON uploads_attachmentlink;
DROP FUNCTION uploads_lab_paddle_parent_complete(); DROP FUNCTION uploads_lab_paddle_parent_guard();
"""


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    if (
        apps.get_model("uploads", "AttachmentLink")
        .objects.filter(lab_paddle_command__isnull=False)
        .exists()
    ):
        raise IrreversibleError(
            "Retain actual paddle evidence purpose and immutable command parent."
        )


class Migration(migrations.Migration):
    dependencies = [
        ("uploads", "0007_independent_qa_and_paddles"),
        ("lab", "0005_independent_qa_guards"),
    ]
    operations = [
        migrations.RunSQL(FORWARD, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
