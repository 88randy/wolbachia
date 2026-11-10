"""TRUNCATE skips row triggers: a statement trigger refuses it too. Adds the revoke action."""

from django.db import migrations, models

FORWARD_SQL = """
CREATE TRIGGER platform_admin_platformauditentry_truncate_guard BEFORE TRUNCATE
ON platform_admin_platformauditentry FOR EACH STATEMENT
EXECUTE FUNCTION platform_audit_insert_only_guard();
"""
REVERSE_SQL = """
DROP TRIGGER platform_admin_platformauditentry_truncate_guard
ON platform_admin_platformauditentry;
"""


class Migration(migrations.Migration):
    dependencies = [("platform_admin", "0002_audit_insert_only_guard")]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.AlterField(
            model_name="platformauditentry",
            name="action",
            field=models.CharField(
                choices=[
                    ("organization.create", "Organization Create"),
                    ("organization.defaults_apply", "Organization Defaults Apply"),
                    ("organization.logo_upload", "Organization Logo Upload"),
                    ("organization.suspend", "Organization Suspend"),
                    ("organization.reactivate", "Organization Reactivate"),
                    ("center.create", "Center Create"),
                    ("admin.create", "Admin Create"),
                    ("platform_admin.grant", "Platform Admin Grant"),
                    ("platform_admin.revoke", "Platform Admin Revoke"),
                ],
                max_length=40,
            ),
        ),
    ]
