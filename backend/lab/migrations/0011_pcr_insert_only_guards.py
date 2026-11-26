"""PCR facts are insert-only in PostgreSQL too (the external lab catalog stays editable)."""

from django.db import migrations

TABLES = (
    "pcrbatch",
    "pcrbatchsample",
    "pcrbatchevent",
    "pcrresult",
    "pcrresultvoid",
    "pcrreport",
)
FORWARD = "\n".join(
    f"CREATE TRIGGER lab_{table}_guard BEFORE UPDATE OR DELETE ON lab_{table} "
    "FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();"
    for table in TABLES
)
REVERSE = "\n".join(f"DROP TRIGGER lab_{table}_guard ON lab_{table};" for table in TABLES)


class Migration(migrations.Migration):
    dependencies = [("lab", "0010_pcr_batches")]
    operations = [migrations.RunSQL(FORWARD, REVERSE)]
