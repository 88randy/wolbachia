"""Real capture/authority fixtures shared by the B17 journeys, without source rewrites."""

import pytest

from organizations.models import ConfigurationRevision, Membership
from tests.factories import MotorcycleFactory
from tests.fleet_support import grant_fleet_scope
from tests.shift_support import make_check_items, open_event
from tests.sync_support import make_phone
from uploads.access import UploadActor


def audit_current_membership(member):
    """An actual server observation made BEFORE these fixtures capture their source."""
    from organizations.services import _profile_snapshot

    proofs = []
    for profile in member.profiles.all():
        snapshot = _profile_snapshot(profile)
        proof, _created = ConfigurationRevision.objects.get_or_create(
            organization=member.organization,
            kind="role",
            target_id=profile.pk,
            revision=profile.revision,
            defaults={"created_by": member.user, "snapshot": snapshot},
        )
        assert proof.snapshot == snapshot
        proofs.append(proof)
    proofs.append(
        ConfigurationRevision.objects.create(
            organization=member.organization,
            created_by=member.user,
            kind="membership",
            target_id=member.pk,
            revision=member.revision,
            snapshot={
                "user": str(member.user_id),
                "profiles": [str(profile.pk) for profile in member.profiles.all()],
                "scope": member.scope,
                "is_active": member.is_active,
            },
        )
    )
    return proofs


def reviewed_open(org, make_member, *, severe=True, code="B17-MOTO"):
    def scoped_member(*args, **kwargs):
        return grant_fleet_scope(make_member(*args, **kwargs))

    phone = make_phone(
        scoped_member, org, codes=("field_event.sync", "field.bootstrap", "field.upload")
    )
    member = Membership.objects.get(organization=org, user=phone.user)
    audit_current_membership(member)
    make_check_items(org)
    motorcycle = MotorcycleFactory(organization=org, code=code)
    capture = open_event(motorcycle.code)
    if severe:
        capture["payload"]["checks"][0]["result"] = "severe"
    response = phone.sync([capture])
    assert response.status_code == 200, response.data
    from reviews.models import ReviewItem

    item = ReviewItem.objects.select_related(
        "field_event__organization", "field_event__created_by", "field_event__device"
    ).get(field_event_id=capture["id"])
    return phone, motorcycle, item, capture


def reviewer(org, make_member):
    user, _member = grant_fleet_scope(
        make_member(
            org,
            (
                "review_item.read",
                "review_item.decide",
                "shift.read",
                "shift.validate",
                "incident.create",
                "incident.read",
                "field.upload",
            ),
        )
    )
    return UploadActor(user, org)


def legacy_severe_open(org, make_member, *, partial=False):
    """Use the real old writer, retaining its rows without disabling any SQL guard."""
    from uuid import UUID

    from accounts.models import Device
    from field_sync.envelope import describe_payload
    from field_sync.exceptions import EventNeedsReview
    from field_sync.registry import EventContext
    from reviews.inspection import original_source_envelope, validated_original_payload
    from reviews.services import create_review_item
    from reviews.transactions import review_transaction
    from shifts.services import open_shift
    from tests.factories import FieldEventFactory

    def scoped_member(*args, **kwargs):
        return grant_fleet_scope(make_member(*args, **kwargs))

    phone = make_phone(scoped_member, org)
    audit_current_membership(Membership.objects.get(organization=org, user=phone.user))
    make_check_items(org)
    motorcycle = MotorcycleFactory(organization=org)
    capture = open_event(motorcycle.code)
    capture["payload"]["checks"][0]["result"] = "severe"
    source = FieldEventFactory(
        id=UUID(capture["id"]),
        organization=org,
        created_by=phone.user,
        device=Device.objects.get(pk=phone.device_id),
        type="shift.open",
        shift_id=UUID(capture["shift_id"]),
        payload=capture["payload"],
        payload_sha256=describe_payload(capture["payload"]).sha256,
        status="in_review",
        status_code="severe_check",
    )
    envelope = original_source_envelope(source)
    ctx = EventContext(org, phone.user, source.device, envelope, source.server_received_at)
    with review_transaction(UploadActor(phone.user, org), source, set()):
        data = validated_original_payload(source)
        if partial:
            data = data | {"checks": data["checks"][:1]}
        with pytest.raises(EventNeedsReview) as observation:
            open_shift(ctx, data)
        assert observation.value.code == "severe_check"
        item = create_review_item(source)
    return phone, motorcycle, item


def legacy_decreased_close(phone, shift):
    """A legitimate close by the same courier on another authenticated device."""
    from accounts.models import Device
    from field_sync.envelope import describe_payload
    from field_sync.exceptions import EventNeedsReview
    from field_sync.registry import EventContext
    from reviews.inspection import original_source_envelope
    from reviews.services import create_review_item
    from reviews.transactions import review_transaction
    from shifts.review import ShiftReviewAdapter
    from shifts.services import close_shift
    from tests.factories import FieldEventFactory
    from tests.sync_support import second_device_of

    second = second_device_of(phone)
    payload = {"odometer_km": shift.odometer_open_km - 1, "note": "Actual historical close"}
    source = FieldEventFactory(
        organization=phone.organization,
        created_by=phone.user,
        device=Device.objects.get(pk=second.device_id),
        type="shift.close",
        shift_id=shift.pk,
        payload=payload,
        payload_sha256=describe_payload(payload).sha256,
        status="in_review",
        status_code="odometer_decreased",
    )
    ctx = EventContext(
        phone.organization,
        phone.user,
        source.device,
        original_source_envelope(source),
        source.server_received_at,
    )
    with review_transaction(
        UploadActor(phone.user, phone.organization), source, {shift.opened_event_id}
    ):
        ShiftReviewAdapter().prepare_boundary(ctx, payload)
        with pytest.raises(EventNeedsReview) as observation:
            close_shift(ctx, payload)
        assert observation.value.code == "odometer_decreased"
        return create_review_item(source)
