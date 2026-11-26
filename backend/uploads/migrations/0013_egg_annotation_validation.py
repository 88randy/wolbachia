"""Validate existing rows outside the metadata-changing migration transaction."""

from django.db import migrations


class Migration(migrations.Migration):
    atomic = False
    dependencies = [("uploads", "0012_egg_annotations"), ("lab", "0016_egg_annotation_guards")]
    operations = [
        migrations.RunSQL(
            f"ALTER TABLE uploads_attachmentlink VALIDATE CONSTRAINT {name}",
            reverse_sql=migrations.RunSQL.noop,
        )
        for name in ("upload_annotation_fk", "upload_annotation_org_fk", "attachment_exactly_one_parent")
    ]
