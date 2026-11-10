"""Current whole-vector authority precedes shipment/material pagination."""

from typing import Any

from django.db.models import Exists, OuterRef, Q, QuerySet

from inventory.transfers.scope import paired_query
from lab.samples.selectors import sample_contexts, sample_pair_query
from lab.shipments.models import MaterialRequest, ShipmentSource, UiebShipment
from uploads.access import UploadActor, current_scope


def request_rows(actor: UploadActor, permission: str) -> QuerySet[MaterialRequest]:
    rows = MaterialRequest.objects.filter(organization=actor.organization).select_related(
        "location", "lot", "piece", "unit_version"
    )
    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if permission in codes:
            allowed |= paired_query(grant, "location__center_id", "location__quadrant_id")
    return rows.filter(allowed).order_by("-created_at", "pk")


def shipment_rows(actor: UploadActor, permission: str) -> QuerySet[UiebShipment]:
    rows = UiebShipment.objects.filter(organization=actor.organization)
    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if permission in codes:
            hidden = ShipmentSource.objects.filter(shipment_id=OuterRef("pk")).exclude(
                paired_query(grant, "center_id", "quadrant_id")
                & (Q(sample__isnull=True) | sample_pair_query(grant, "sample__"))
            )
            eligible = rows.filter(~Exists(hidden), sources__isnull=False)
            allowed |= Q(pk__in=eligible.values("pk"))
    return rows.filter(allowed).order_by("-created_at", "pk")


def shipment_contexts(shipment: UiebShipment) -> list[dict[str, Any]]:
    contexts = [
        {
            "center_id": str(source.center_id),
            "quadrant_id": str(source.quadrant_id) if source.quadrant_id else None,
        }
        for source in shipment.sources.all()
    ]
    for source in shipment.sources.filter(sample__isnull=False).select_related(
        "sample__location",
        "sample__lot",
        "sample__reading__ovitrap__sampling_point__block__quadrant",
    ):
        contexts.extend(sample_contexts(source.sample))
    return contexts


def request_contexts(request: MaterialRequest) -> list[dict[str, Any]]:
    return [
        {
            "center_id": str(subject.center_id),
            "quadrant_id": str(subject.quadrant_id) if subject.quadrant_id else None,
        }
        for subject in (request.location,)
    ]


def request_revision(request: MaterialRequest) -> int:
    return (
        request.notifications.count()
        + int(hasattr(request, "delivery"))
        + int(hasattr(request, "void"))
    )


def request_projection(request: MaterialRequest) -> dict[str, Any]:
    return {
        "id": str(request.pk),
        "code": request.code,
        "recipient_institution": request.recipient_institution,
        "lot_id": str(request.lot_id),
        "location_id": str(request.location_id),
        "piece_id": str(request.piece_id) if request.piece_id else None,
        "unit_version_id": str(request.unit_version_id),
        "quantity": str(request.quantity),
        "revision": request_revision(request),
        "is_voided": hasattr(request, "void"),
        "delivery_id": str(request.delivery.pk) if hasattr(request, "delivery") else None,
        "notifications": [
            {
                "id": str(row.pk),
                "reference": row.reference,
                "date": row.date.isoformat(),
                "evidence_id": str(row.upload.public_id),
            }
            for row in request.notifications.select_related("upload").order_by("created_at", "pk")
        ],
    }


def shipment_projection(actor: UploadActor, shipment: UiebShipment) -> dict[str, Any]:
    from privacy.selectors import can_transfer_rfc

    eligible = can_transfer_rfc(actor, shipment.recipient_institution, shipment_contexts(shipment))
    # #100 owns the protected RFC source. A transfer grant never fabricates that source.
    omission = "rfc_source_unavailable" if eligible else "rfc_transfer_not_authorized"
    return {
        "id": str(shipment.pk),
        "code": shipment.code,
        "cutoff": shipment.cutoff.isoformat(),
        "template_version": shipment.template_version,
        "recipient_institution": shipment.recipient_institution,
        "source_snapshot": shipment.source_snapshot,
        "content_hash": shipment.content_hash,
        "supersedes_id": str(shipment.supersedes_id) if shipment.supersedes_id else None,
        "is_superseded": hasattr(shipment, "revision")
        or hasattr(shipment, "void")
        or source_changed(shipment),
        "rfc": "",
        "rfc_omission_code": omission,
    }


def source_changed(shipment: UiebShipment) -> bool:
    from inventory.models import LotVersion

    pins = {row["id"]: row for row in shipment.source_snapshot}
    for source in shipment.sources.select_related(
        "bag__event", "sample__event", "sample__reading__event"
    ):
        if source.bag_id and source.bag.event.voided_at is not None:
            return True
        if source.sample_id and sample_source_changed(source.sample, pins[str(source.sample_id)]):
            return True
        if source.lot_id:
            latest = LotVersion.objects.filter(lot_id=source.lot_id).order_by("-revision").first()
            if latest is None or str(latest.pk) != pins[str(source.lot_id)]["version_id"]:
                return True
    return False


def sample_source_changed(sample: Any, pin: dict[str, Any]) -> bool:  # noqa: ANN401 -- genuine retained sample
    from inventory.models import LotVersion

    if sample.event.voided_at is not None or (
        sample.reading_id and sample.reading.event.voided_at is not None
    ):
        return True
    if sample.lot_id:
        latest = LotVersion.objects.filter(lot_id=sample.lot_id).order_by("-revision").first()
        return latest is None or str(latest.pk) != pin["lot_version_id"]
    return False
