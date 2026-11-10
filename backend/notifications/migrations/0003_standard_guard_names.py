"""Match the repository's enabled immutable-table guard naming convention."""

from django.db import migrations

FORWARD = """
ALTER TRIGGER notifications_content_guard ON notifications_notification
RENAME TO notifications_notification_guard;
ALTER TRIGGER notifications_read_guard ON notifications_notificationread
RENAME TO notifications_notificationread_guard;
ALTER TRIGGER notifications_preference_guard ON notifications_preferenceversion
RENAME TO notifications_preferenceversion_guard;
"""

REVERSE = """
ALTER TRIGGER notifications_notification_guard ON notifications_notification
RENAME TO notifications_content_guard;
ALTER TRIGGER notifications_notificationread_guard ON notifications_notificationread
RENAME TO notifications_read_guard;
ALTER TRIGGER notifications_preferenceversion_guard ON notifications_preferenceversion
RENAME TO notifications_preference_guard;
"""


class Migration(migrations.Migration):
    dependencies = [("notifications", "0002_immutable_and_tenant_guards")]
    operations = [migrations.RunSQL(FORWARD, REVERSE)]
