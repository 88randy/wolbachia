"""Own regulatory provenance, CAS and the one paired-scope API wiring boundary."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from geography.models import Quadrant
from organizations.models import Center, all_scope
from releases.models import Permit, PermitSuspensionNotice
from releases.services import create_permit, create_permit_type
from tests.people_support import verified_training_evidence
from uploads.access import UploadActor

GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[[-100, 20], [-99, 20], [-99, 21], [-100, 21], [-100, 20]]],
}


def grant_scope(member, scope):
    member.scope = scope
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = scope
    profile.save(update_fields=["scope"])


def pair_scope(center, quadrant):
    return {
        "centers": {"mode": "selected", "ids": [str(center.pk)]},
        "quadrants": {"mode": "selected", "ids": [str(quadrant.pk)]},
    }


@pytest.fixture
def permits(org_a, make_member, monkeypatch, settings, tmp_path):
    now = datetime(2026, 7, 14, 12, tzinfo=UTC)
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "permit-evidence"
    user, member = make_member(
        org_a, ("permit.manage", "permit.suspend", "release.read", "field.upload")
    )
    grant_scope(member, all_scope())
    center = Center.objects.create(
        organization=org_a, created_by=user, code="C-116", name="Synthetic release center"
    )
    quadrant = Quadrant.objects.create(
        organization=org_a, created_by=user, center=center, code="Q-116"
    )
    context = SimpleNamespace(
        organization=org_a,
        user=user,
        member=member,
        actor=UploadActor(user, org_a),
        center=center,
        quadrant=quadrant,
        now=now,
    )
    context.document_id = verified_training_evidence(context)
    context.successor_document_id = verified_training_evidence(context)
    context.kind = create_permit_type(
        context.actor,
        {
            "code": "OFFICIAL-116",
            "name": "Synthetic reviewed authorization",
            "requirements": {"max_gps_accuracy_m": 25},
        },
    )
    context.values = {
        "code": "P-116",
        "quadrant_id": quadrant.pk,
        "type_id": context.kind.pk,
        "number": "Official synthetic number",
        "authority": "Synthetic regulatory authority",
        "official_document_id": context.document_id,
        "document_attestation": "Reviewed official synthetic permit geometry",
        "geometry": GEOMETRY,
        "valid_from": now - timedelta(days=1),
        "valid_to": now + timedelta(days=10),
    }
    context.permit = create_permit(context.actor, context.values)
    return context


def version_body(context, **overrides):
    return {
        "type": str(context.kind.pk),
        "number": "Reviewed successor number",
        "authority": "Synthetic regulatory authority",
        "official_document": str(context.successor_document_id),
        "document_attestation": "Reviewed official successor document geometry",
        "geometry": GEOMETRY,
        "valid_from": context.now.isoformat(),
        "valid_to": (context.now + timedelta(days=20)).isoformat(),
        "expected_revision": 1,
        **overrides,
    }


@pytest.mark.django_db(transaction=True)
def test_reviewed_official_versions_and_suspension_retain_proof_and_reject_stale_revision(
    permits,
    api_client,
):
    original = permits.permit.versions.get()
    api_client.force_authenticate(permits.user)
    answer = api_client.post(
        f"/api/v1/permits/{permits.permit.pk}/versions/", version_body(permits), format="json"
    )
    assert answer.status_code == 201, answer.data
    assert answer.data["requirements"] == {"max_gps_accuracy_m": 25}
    assert answer.data["revision"] == 2
    original.refresh_from_db()
    assert original.geometry == GEOMETRY
    assert original.type_id == permits.kind.pk
    assert original.official_document.upload.public_id == permits.document_id
    assert original.created_by_id == permits.user.pk
    assert original.document_attestation == permits.values["document_attestation"]
    path = f"/api/v1/permits/{permits.permit.pk}/suspend/"
    stale = api_client.post(
        path, {"reason": "Valid regulatory suspension", "expected_revision": 1}, format="json"
    )
    assert stale.status_code == 409
    assert stale.data["blocked_by"][0]["reason"] == "permit_revision_conflict"
    assert not Permit.objects.filter(pk=permits.permit.pk, suspension__isnull=False).exists()
    suspended = api_client.post(
        path,
        {"reason": "  Verified regulatory suspension\r\n", "expected_revision": 2},
        format="json",
    )
    assert suspended.status_code == 200, suspended.data
    assert suspended.data["reason"] == "Verified regulatory suspension"
    assert str(suspended.data["created_by"]) == str(permits.user.pk)
    refused = api_client.post(
        f"/api/v1/permits/{permits.permit.pk}/versions/",
        version_body(permits, expected_revision=3),
        format="json",
    )
    assert refused.status_code == 409
    assert refused.data["blocked_by"][0]["reason"] == "permit_suspended"
    assert permits.permit.versions.count() == 2


@pytest.mark.django_db(transaction=True)
def test_permit_api_default_denies_and_filters_whole_org_center_quadrant_pairs(
    permits,
    org_b,
    make_member,
    api_client,
):
    center = Center.objects.create(
        organization=permits.organization,
        created_by=permits.user,
        code="C-OTHER-116",
        name="Other center",
    )
    other_quadrant = Quadrant.objects.create(
        organization=permits.organization,
        created_by=permits.user,
        center=permits.center,
        code="Q-OTHER-116",
    )
    other_center_quadrant = Quadrant.objects.create(
        organization=permits.organization,
        created_by=permits.user,
        center=center,
        code="Q-CENTER-116",
    )
    hidden = [
        Permit.objects.create(
            organization=permits.organization,
            created_by=permits.user,
            center=quadrant.center,
            quadrant=quadrant,
            code=quadrant.code,
        )
        for quadrant in (other_quadrant, other_center_quadrant)
    ]
    foreign_center = Center.objects.create(
        organization=org_b, created_by=permits.user, code="C-FOREIGN-116", name="Foreign center"
    )
    foreign_quadrant = Quadrant.objects.create(
        organization=org_b, created_by=permits.user, center=foreign_center, code="Q-FOREIGN-116"
    )
    hidden.append(
        Permit.objects.create(
            organization=org_b,
            created_by=permits.user,
            center=foreign_center,
            quadrant=foreign_quadrant,
            code="P-FOREIGN-116",
        )
    )
    denied, denied_member = make_member(permits.organization)
    grant_scope(denied_member, all_scope())
    api_client.force_authenticate(denied)
    assert api_client.get("/api/v1/permits/").status_code == 403
    user, member = make_member(permits.organization, ("permit.manage", "permit.suspend"))
    grant_scope(member, pair_scope(permits.center, permits.quadrant))
    api_client.force_authenticate(user)
    assert api_client.options("/api/v1/permits/").status_code == 403
    assert api_client.get(f"/api/v1/permits/{permits.permit.pk}/").status_code == 200
    rows = api_client.get("/api/v1/permits/", {"code": permits.permit.code})
    assert rows.status_code == 200, rows.data
    assert [row["id"] for row in rows.data["results"]] == [str(permits.permit.pk)]
    for target in hidden:
        assert api_client.get(f"/api/v1/permits/{target.pk}/").status_code == 404
        assert (
            api_client.post(
                f"/api/v1/permits/{target.pk}/suspend/",
                {"reason": "Valid regulatory suspension", "expected_revision": 1},
                format="json",
            ).status_code
            == 404
        )
    for mode in ("none", "selected"):
        scope = pair_scope(permits.center, permits.quadrant)
        scope["quadrants"] = {"mode": mode, "ids": []}
        grant_scope(member, scope)
        assert api_client.get(f"/api/v1/permits/{permits.permit.pk}/").status_code == 404
        assert api_client.get("/api/v1/permits/").data["count"] == 0


@pytest.mark.django_db(transaction=True)
def test_suspension_records_only_actual_scoped_courier_and_coordinator_recipients(
    permits,
    make_member,
    api_client,
):
    recipients = []
    for code in ("field.bootstrap", "release.read"):
        _user, member = make_member(permits.organization, (code,))
        grant_scope(member, pair_scope(permits.center, permits.quadrant))
        recipients.append(member.pk)
    _user, hidden = make_member(permits.organization, ("field.bootstrap", "release.read"))
    scope = pair_scope(permits.center, permits.quadrant)
    scope["quadrants"] = {"mode": "selected", "ids": []}
    grant_scope(hidden, scope)
    api_client.force_authenticate(permits.user)
    answer = api_client.post(
        f"/api/v1/permits/{permits.permit.pk}/suspend/",
        {"reason": "Official scoped suspension notice", "expected_revision": 1},
        format="json",
    )
    assert answer.status_code == 200, answer.data
    notices = PermitSuspensionNotice.objects.filter(suspension__permit=permits.permit)
    assert set(notices.values_list("recipient_id", flat=True)) == {permits.member.pk, *recipients}
    assert not notices.filter(recipient=hidden).exists()
    assert set(notices.values_list("kind", flat=True)) == {"courier", "coordinator"}
    assert set(notices.values_list("status", flat=True)) == {"delivery_unavailable"}
    assert all(
        notice.scope_snapshot["quadrant_id"] == str(permits.quadrant.pk) for notice in notices
    )


@pytest.mark.django_db(transaction=True)
def test_equipment_status_is_an_authored_revision_without_rewriting_biological_lineage(
    permits,
    make_member,
    api_client,
):
    from releases.services import create_release_device
    from tests.inventory_support import inventory_context

    stock = inventory_context(
        permits.organization, make_member, biological=True, quadrant=permits.quadrant
    )
    device = create_release_device(
        permits.actor,
        {
            "code": "DEVICE-116",
            "quadrant_id": permits.quadrant.pk,
            "source_lot_id": stock.lot.pk,
        },
    )
    api_client.force_authenticate(permits.user)
    path = f"/api/v1/release-devices/{device.pk}/status/"
    body = {
        "status": "inactive",
        "reason": "Equipment blocked after inspection",
        "expected_revision": 1,
    }
    changed = api_client.post(path, body, format="json")
    assert changed.status_code == 200, changed.data
    assert str(changed.data["created_by"]) == str(permits.user.pk)
    assert changed.data["revision"] == 2
    stale = api_client.post(path, body, format="json")
    assert stale.status_code == 409
    assert stale.data["blocked_by"][0]["reason"] == "release_device_revision_conflict"
    detail = api_client.get(f"/api/v1/release-devices/{device.pk}/")
    assert detail.status_code == 200, detail.data
    assert detail.data["status"] == "inactive"
    assert detail.data["blocked_by"][0]["reason"] == "release_device_inactive"
    device.refresh_from_db()
    assert device.source_lot_id == stock.lot.pk
    assert device.source_lot_version_id == stock.version.pk
    assert device.status == "active"
    assert (
        api_client.post(
            path,
            {
                "status": "retired",
                "reason": "Equipment permanently retired",
                "expected_revision": 2,
            },
            format="json",
        ).status_code
        == 200
    )
    refused = api_client.post(
        path,
        {
            "status": "active",
            "reason": "Attempt to reactivate retired equipment",
            "expected_revision": 3,
        },
        format="json",
    )
    assert refused.status_code == 409
    assert refused.data["blocked_by"][0]["reason"] == "release_device_retired"


@pytest.mark.django_db(transaction=True)
def test_official_document_downloads_as_attachment_with_nosniff(permits, api_client):
    api_client.force_authenticate(permits.user)
    base = f"/api/v1/permits/{permits.permit.pk}/versions"
    answer = api_client.get(f"{base}/1/document/")
    assert answer.status_code == 200
    assert answer["Content-Disposition"].startswith("attachment")
    assert answer["X-Content-Type-Options"] == "nosniff"
    assert answer["Content-Type"] == "image/png"
    assert answer["Cache-Control"] == "private, no-store"
    assert answer.content.startswith(b"\x89PNG")
    assert api_client.get(f"{base}/9/document/").status_code == 404


@pytest.mark.django_db(transaction=True)
def test_official_document_is_coded_404_for_another_organization(
    permits, api_client, org_b, make_member
):
    other, _member = make_member(org_b, ("permit.manage",))
    api_client.force_authenticate(other)
    answer = api_client.get(f"/api/v1/permits/{permits.permit.pk}/versions/1/document/")
    assert answer.status_code == 404
    assert "code" in answer.json()


@pytest.mark.django_db(transaction=True)
def test_official_document_requires_permit_permission(permits, api_client, make_member):
    reader, _member = make_member(permits.organization, ("release.read",))
    api_client.force_authenticate(reader)
    answer = api_client.get(f"/api/v1/permits/{permits.permit.pk}/versions/1/document/")
    assert answer.status_code == 403
