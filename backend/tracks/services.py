"""Writes of the courier track outside the sync pipeline: the view receipts."""

from datetime import UTC

from django.utils import timezone

from shifts.models import Shift
from tracks.models import TrackViewKind, TrackViewReceipt
from uploads.access import UploadActor


def record_track_view(actor: UploadActor, kind: TrackViewKind, shift: Shift | None = None) -> None:
    """Insert the receipt of this read for the current UTC hour, once (writes TrackViewReceipt).

    A repeat within the hour is absorbed by the unique constraint (`ignore_conflicts`), so polling
    neither fails nor adds rows.
    """
    hour = timezone.now().astimezone(UTC).replace(minute=0, second=0, microsecond=0)
    TrackViewReceipt.objects.bulk_create(
        [
            TrackViewReceipt(
                organization=actor.organization,
                created_by=actor.user,
                viewer=actor.user,
                shift=shift,
                kind=kind,
                hour=hour,
            )
        ],
        ignore_conflicts=True,
    )
