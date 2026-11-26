"""Name the existing insert-only row guards `<table>_guard`, the convention structure tests check.

Metadata-only: the guard functions and trigger semantics are unchanged.
"""

from django.db import migrations

FORWARD_SQL = """
SET LOCAL lock_timeout = '2s';
ALTER TRIGGER egg_annotation_immutable ON lab_eggannotation RENAME TO lab_eggannotation_guard;
ALTER TRIGGER annotation_export_immutable ON lab_eggannotationexport RENAME TO lab_eggannotationexport_guard;
ALTER TRIGGER annotation_export_item_immutable ON lab_eggannotationexportitem RENAME TO lab_eggannotationexportitem_guard;
ALTER TRIGGER annotation_export_status_immutable ON lab_eggannotationexportstatus RENAME TO lab_eggannotationexportstatus_guard;
ALTER TRIGGER annotation_export_download_immutable ON lab_eggannotationexportdownload RENAME TO lab_eggannotationexportdownload_guard;
ALTER TRIGGER uploads_sanitization_failure_guard ON uploads_uploadsanitizationfailure RENAME TO uploads_uploadsanitizationfailure_guard;
"""

REVERSE_SQL = """
SET LOCAL lock_timeout = '2s';
ALTER TRIGGER lab_eggannotation_guard ON lab_eggannotation RENAME TO egg_annotation_immutable;
ALTER TRIGGER lab_eggannotationexport_guard ON lab_eggannotationexport RENAME TO annotation_export_immutable;
ALTER TRIGGER lab_eggannotationexportitem_guard ON lab_eggannotationexportitem RENAME TO annotation_export_item_immutable;
ALTER TRIGGER lab_eggannotationexportstatus_guard ON lab_eggannotationexportstatus RENAME TO annotation_export_status_immutable;
ALTER TRIGGER lab_eggannotationexportdownload_guard ON lab_eggannotationexportdownload RENAME TO annotation_export_download_immutable;
ALTER TRIGGER uploads_uploadsanitizationfailure_guard ON uploads_uploadsanitizationfailure RENAME TO uploads_sanitization_failure_guard;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("lab", "0020_annotation_export_disclosure"),
        ("uploads", "0014_sanitization_failure"),
    ]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
