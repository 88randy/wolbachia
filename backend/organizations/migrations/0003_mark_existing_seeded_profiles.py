from django.db import migrations

# Slugs of the profiles the seed of #2 creates (frozen here: a migration must not import code).
DEFAULT_SEED_SLUGS = ["courier", "supervisor", "entomologist", "community_promoter", "admin"]


def mark_seeded_profiles(apps, schema_editor):
    """Profiles with a default slug and no author were created by the seed of #2.

    Marking them lets `seed_organization_defaults --apply` grant their default permission codes.
    A profile an admin created has an author (`created_by`) and stays unmarked.
    """
    Profile = apps.get_model("organizations", "Profile")
    Profile.objects.filter(slug__in=DEFAULT_SEED_SLUGS, created_by__isnull=True).update(
        created_by_seed=True
    )


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0002_profile_seed_bookkeeping"),
    ]

    operations = [
        # Reverse is a no-op: the marker added by 0002 is dropped with its column.
        migrations.RunPython(mark_seeded_profiles, migrations.RunPython.noop),
    ]
