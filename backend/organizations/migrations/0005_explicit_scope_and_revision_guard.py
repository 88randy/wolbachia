"""SA02: preserve selected assignments, never infer all from a legacy empty array."""
from django.db import migrations


DIMENSIONS = ("centers", "quadrants")


def convert_scopes(apps, schema_editor):
    Membership = apps.get_model("organizations", "Membership")
    Profile = apps.get_model("organizations", "Profile")
    alias = schema_editor.connection.alias
    for member in Membership.objects.using(alias).all().iterator():
        stored = member.scope if isinstance(member.scope, dict) else {}
        converted = {}
        for dimension in DIMENSIONS:
            ids = stored.get(dimension, [])
            if isinstance(ids, list):
                converted[dimension] = {"mode": "selected" if ids else "none", "ids": ids}
            else:
                converted[dimension] = {"mode": "none", "ids": []}
        Membership.objects.using(alias).filter(pk=member.pk).update(scope=converted)
    # Profiles previously had no scope limit; memberships still bound every grant.
    Profile.objects.using(alias).all().update(scope={name: {"mode": "all", "ids": []} for name in DIMENSIONS})


def reverse_scopes(apps, schema_editor):
    Membership = apps.get_model("organizations", "Membership")
    alias = schema_editor.connection.alias
    for member in Membership.objects.using(alias).all().iterator():
        # The legacy shape cannot represent all; downgrade to deny, never widen it.
        stored = member.scope if isinstance(member.scope, dict) else {}
        converted = {name: stored.get(name, {}).get("ids", []) if isinstance(stored.get(name), dict) and stored[name].get("mode") == "selected" else [] for name in DIMENSIONS}
        Membership.objects.using(alias).filter(pk=member.pk).update(scope=converted)


FORWARD_SQL = """
CREATE FUNCTION organizations_configurationrevision_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'configuration revisions are insert-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER organizations_configurationrevision_guard
BEFORE UPDATE OR DELETE ON organizations_configurationrevision
FOR EACH ROW EXECUTE FUNCTION organizations_configurationrevision_guard();
"""
REVERSE_SQL = """
DROP TRIGGER organizations_configurationrevision_guard ON organizations_configurationrevision;
DROP FUNCTION organizations_configurationrevision_guard();
"""


class Migration(migrations.Migration):
    dependencies = [("organizations", "0004_membership_revision_organization_epi_week_and_more")]
    operations = [
        migrations.RunPython(convert_scopes, reverse_scopes),
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
    ]
