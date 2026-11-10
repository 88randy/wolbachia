"""Minimal purpose/recipient/field authorization, never personal values."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("organizations", "0005_explicit_scope_and_revision_guard"),
        ("geography", "0003_thirdpartyintervention_thirdpartyinterventionblock_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="DataTransferAuthorization",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("recipient_institution", models.CharField(max_length=200)),
                ("purpose", models.CharField(choices=[("uieb_shipment", "uieb_shipment")], max_length=32)),
                ("fields", models.JSONField()),
                ("valid_from", models.DateTimeField()),
                ("valid_until", models.DateTimeField()),
                ("reference", models.CharField(max_length=1000)),
                ("center", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="+", to="organizations.center")),
                ("quadrant", models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to="geography.quadrant")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="+", to="organizations.organization")),
            ],
            options={
                "abstract": False,
                "base_manager_name": "objects",
                "constraints": [
                    models.CheckConstraint(condition=models.Q(created_by__isnull=False), name="privacy_datatransferauthorization_author"),
                    models.CheckConstraint(condition=models.Q(valid_until__gt=models.F("valid_from")), name="privacy_transfer_valid_interval"),
                    models.CheckConstraint(condition=models.Q(purpose="uieb_shipment", fields=["rfc"]), name="privacy_transfer_supported_fields"),
                ],
            },
        ),
        migrations.CreateModel(
            name="DataTransferRevocation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reason", models.TextField()),
                ("authorization", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="revocation", to="privacy.datatransferauthorization")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="+", to="organizations.organization")),
            ],
            options={
                "abstract": False,
                "base_manager_name": "objects",
                "constraints": [models.CheckConstraint(condition=models.Q(created_by__isnull=False), name="privacy_datatransferrevocation_author")],
            },
        ),
    ]
