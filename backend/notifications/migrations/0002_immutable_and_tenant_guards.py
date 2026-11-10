"""Database backstops for append-only owner-scoped notification history."""

from django.db import migrations

GUARDS = """
CREATE FUNCTION notifications_guard_history() RETURNS trigger AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Notification history is insert-only' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'notifications_notificationread' THEN
        IF NOT EXISTS (
            SELECT 1 FROM notifications_notification n
            JOIN organizations_membership m ON m.id = n.recipient_id
            WHERE n.id = NEW.notification_id AND n.organization_id = NEW.organization_id
            AND m.organization_id = NEW.organization_id AND m.user_id = NEW.created_by_id
        ) THEN
            RAISE EXCEPTION 'Read receipt owner or organization mismatch' USING ERRCODE = '23514';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM organizations_membership m
            WHERE m.id = NEW.recipient_id AND m.organization_id = NEW.organization_id
            AND (TG_TABLE_NAME <> 'notifications_preferenceversion' OR m.user_id = NEW.created_by_id)
        ) THEN
            RAISE EXCEPTION 'Notification recipient organization mismatch' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER notifications_content_guard BEFORE INSERT OR UPDATE OR DELETE
ON notifications_notification FOR EACH ROW EXECUTE FUNCTION notifications_guard_history();
CREATE TRIGGER notifications_read_guard BEFORE INSERT OR UPDATE OR DELETE
ON notifications_notificationread FOR EACH ROW EXECUTE FUNCTION notifications_guard_history();
CREATE TRIGGER notifications_preference_guard BEFORE INSERT OR UPDATE OR DELETE
ON notifications_preferenceversion FOR EACH ROW EXECUTE FUNCTION notifications_guard_history();
"""
REVERSE = """
DROP TRIGGER notifications_preference_guard ON notifications_preferenceversion;
DROP TRIGGER notifications_read_guard ON notifications_notificationread;
DROP TRIGGER notifications_content_guard ON notifications_notification;
DROP FUNCTION notifications_guard_history();
"""


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial")]
    operations = [migrations.RunSQL(GUARDS, REVERSE)]
