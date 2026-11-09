"""Append-only transport, immutable byte receipts and one authorized evidence parent."""

import uuid

from django.conf import settings
from django.db import models

from core.models import ImmutableMixin, OrgScopedModel
from uploads.limits import CONTENT_TYPES, MAX_UPLOAD_BYTES


class EvidenceRecord(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True


class Upload(EvidenceRecord):
    public_id = models.UUIDField(default=uuid.uuid4)
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    device = models.ForeignKey(
        "accounts.Device", on_delete=models.PROTECT, null=True, related_name="+"
    )
    content_type = models.CharField(
        max_length=16, choices=[(value, value) for value in CONTENT_TYPES]
    )
    size_bytes = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)

    class Meta(EvidenceRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "public_id"], name="upload_org_public_id"
            ),
            models.CheckConstraint(
                condition=models.Q(size_bytes__gte=1, size_bytes__lte=MAX_UPLOAD_BYTES),
                name="upload_bounded_size",
            ),
        ]


class UploadLease(EvidenceRecord):
    upload = models.ForeignKey(Upload, on_delete=models.PROTECT, related_name="leases")
    revision = models.PositiveIntegerField()
    expires_at = models.DateTimeField()

    class Meta(EvidenceRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["upload", "revision"], name="upload_lease_revision")
        ]


class UploadSource(EvidenceRecord):
    upload = models.OneToOneField(Upload, on_delete=models.PROTECT, related_name="source")
    lease = models.ForeignKey(UploadLease, on_delete=models.PROTECT, related_name="+")
    object_key = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)


class UploadVerification(EvidenceRecord):
    upload = models.OneToOneField(Upload, on_delete=models.PROTECT, related_name="verification")
    source = models.OneToOneField(
        UploadSource, on_delete=models.PROTECT, related_name="verification"
    )
    object_key = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    content_type = models.CharField(max_length=16)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()


class AttachmentLink(EvidenceRecord):
    upload = models.OneToOneField(Upload, on_delete=models.PROTECT, related_name="attachment")
    field_event = models.ForeignKey(
        "field_sync.FieldEvent", null=True, on_delete=models.PROTECT, related_name="attachments"
    )
    fault = models.ForeignKey(
        "shifts.MotorcycleBlockEvent",
        null=True,
        on_delete=models.PROTECT,
        related_name="attachments",
    )
    incident = models.ForeignKey(
        "incidents.Incident", null=True, on_delete=models.PROTECT, related_name="attachments"
    )
    review_item = models.ForeignKey(
        "reviews.ReviewItem", null=True, on_delete=models.PROTECT, related_name="attachments"
    )
    transfer_event = models.ForeignKey(
        "inventory.TransferEvent", null=True, on_delete=models.PROTECT, related_name="attachments"
    )
    lab_rejection = models.ForeignKey(
        "lab.LabRejection", null=True, on_delete=models.PROTECT, related_name="attachments"
    )
    inventory_intent = models.ForeignKey(
        "inventory.InventoryIntent", null=True, on_delete=models.PROTECT, related_name="attachments"
    )

    class Meta(EvidenceRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        field_event__isnull=False,
                        inventory_intent__isnull=True,
                        fault__isnull=True,
                        incident__isnull=True,
                        review_item__isnull=True,
                        transfer_event__isnull=True,
                        lab_rejection__isnull=True,
                    )
                    | models.Q(
                        field_event__isnull=True,
                        fault__isnull=False,
                        inventory_intent__isnull=True,
                        incident__isnull=True,
                        review_item__isnull=True,
                        transfer_event__isnull=True,
                        lab_rejection__isnull=True,
                    )
                    | models.Q(
                        field_event__isnull=True,
                        fault__isnull=True,
                        incident__isnull=False,
                        inventory_intent__isnull=True,
                        review_item__isnull=True,
                        transfer_event__isnull=True,
                        lab_rejection__isnull=True,
                    )
                    | models.Q(
                        field_event__isnull=True,
                        fault__isnull=True,
                        incident__isnull=True,
                        review_item__isnull=False,
                        inventory_intent__isnull=True,
                        transfer_event__isnull=True,
                        lab_rejection__isnull=True,
                    )
                    | models.Q(
                        field_event__isnull=True,
                        fault__isnull=True,
                        incident__isnull=True,
                        review_item__isnull=True,
                        transfer_event__isnull=False,
                        inventory_intent__isnull=True,
                        lab_rejection__isnull=True,
                    )
                    | models.Q(
                        field_event__isnull=True,
                        fault__isnull=True,
                        incident__isnull=True,
                        review_item__isnull=True,
                        transfer_event__isnull=True,
                        lab_rejection__isnull=False,
                        inventory_intent__isnull=True,
                    )
                    | models.Q(
                        field_event__isnull=True,
                        fault__isnull=True,
                        incident__isnull=True,
                        review_item__isnull=True,
                        transfer_event__isnull=True,
                        lab_rejection__isnull=True,
                        inventory_intent__isnull=False,
                    )
                ),
                name="attachment_exactly_one_parent",
            )
        ]
