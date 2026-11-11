"""Store geodesic area/perimeter on quadrant and block versions and backfill history.

The insert-only guard triggers are disabled only for this backfill, inside the migration
transaction, and only the two new derived columns are written.
"""

import json
from typing import Any

from django.db import migrations, models

from geography.geometry import polygon_measurements

TABLES = ("geography_quadrantversion", "geography_blockversion")


def backfill(apps: Any, schema_editor: Any) -> None:  # noqa: ANN401
    with schema_editor.connection.cursor() as cursor:
        for table in TABLES:
            cursor.execute(f"ALTER TABLE {table} DISABLE TRIGGER {table}_guard")
            cursor.execute(f"SELECT id, geometry FROM {table} WHERE area_m2 IS NULL")
            # Django's PostgreSQL connection hands jsonb back as text on a raw cursor.
            rows = [
                (*polygon_measurements(json.loads(raw) if isinstance(raw, str) else raw), pk)
                for pk, raw in cursor.fetchall()
            ]
            cursor.executemany(
                f"UPDATE {table} SET area_m2 = %s, perimeter_m = %s WHERE id = %s", rows
            )
            cursor.execute(f"ALTER TABLE {table} ENABLE TRIGGER {table}_guard")


class Migration(migrations.Migration):
    dependencies = [("geography", "0004_release_points")]
    operations = [
        migrations.AddField(
            model_name="quadrantversion",
            name="area_m2",
            field=models.FloatField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="quadrantversion",
            name="perimeter_m",
            field=models.FloatField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="blockversion",
            name="area_m2",
            field=models.FloatField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="blockversion",
            name="perimeter_m",
            field=models.FloatField(editable=False, null=True),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
