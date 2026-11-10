from django.db import migrations, models


class Migration(migrations.Migration):
    """Choices-only change: Django emits no SQL, so no lock and no data rewrite (#350)."""

    dependencies = [
        ("uploads", "0010_shipments"),
    ]

    operations = [
        migrations.AlterField(
            model_name="upload",
            name="content_type",
            field=models.CharField(
                choices=[
                    ("image/jpeg", "image/jpeg"),
                    ("image/png", "image/png"),
                    ("application/pdf", "application/pdf"),
                ],
                max_length=16,
            ),
        ),
    ]
