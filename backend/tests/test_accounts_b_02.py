"""B02 acceptance: private files, scoped lifecycle and commit-before-disclosure receipts."""

from datetime import timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.models.signals import post_save
from django.utils import timezone
from rest_framework.exceptions import NotFound
from rest_framework.test import APIClient

from accounts import personnel_services, rfc_crypto, views
from accounts.models import AccessLog, DeviceSession, Personnel, RevokeReason, User
from accounts.personnel_services import (
    create_personnel,
    reveal_personnel_rfc,
    rotate_personnel_rfc,
    update_personnel,
)
from accounts.revocation import Revocation, revoke_session
from accounts.rfc_crypto import RfcKeyUnavailableError
from accounts.services import DeviceInfo, start_device_session
from core.exceptions import FieldValidationError
from geography.models import Quadrant
from organizations.models import Center, all_scope
from tests.factories import (
    FieldEventFactory,
    MembershipFactory,
    OrganizationFactory,
    ProfileFactory,
    UserFactory,
)
from tests.test_rfc_crypto import SYNTHETIC_RFC, FakeKms
from uploads.access import UploadActor

pytestmark = pytest.mark.django_db

PEOPLE_CODES = [
    "user.create",
    "user.read",
    "user.update",
    "user.deactivate",
    "user.reveal_rfc",
    "user.operational_read",
    "access_log.read",
]


def make_actor(organization, codes=PEOPLE_CODES):
    user = UserFactory()
    member = MembershipFactory(user=user, organization=organization, scope=all_scope())
    profile = ProfileFactory(
        organization=organization, permission_codes=list(codes), scope=all_scope()
    )
    member.profiles.add(profile)
    return UploadActor(user, organization), member, profile


def make_person(actor, center, **fields):
    member = MembershipFactory(organization=actor.organization, scope=all_scope())
    person = create_personnel(
        actor,
        {
            "membership_id": member.pk,
            "center_id": center.pk,
            "display_name": "Synthetic employee",
            "work_email": "synthetic-work@example.test",
            "work_phone": "synthetic-work-contact",
            **fields,
        },
    )
    return person, member


@pytest.fixture
def setup(monkeypatch, settings):
    kms = FakeKms()
    monkeypatch.setattr(rfc_crypto, "_kms_client", lambda: kms)
    settings.RFC_KMS_KEY_ID = "wrap-v1"
    settings.RFC_KMS_HMAC_KEY_ID = "synthetic-mac-key"
    organization = OrganizationFactory()
    actor, member, profile = make_actor(organization)
    center = Center.objects.create(
        organization=organization, created_by=actor.user, code="SYNTHETIC", name="Synthetic center"
    )
    return SimpleNamespace(actor=actor, member=member, profile=profile, center=center, kms=kms)


@pytest.mark.django_db(transaction=True)
def test_deactivation_ends_scoped_sessions_and_pending_uploads_without_erasing_authorship(setup):
    person, member = make_person(setup.actor, setup.center)
    other = OrganizationFactory()
    elsewhere = MembershipFactory(user=member.user, organization=other, scope=all_scope())
    active = start_device_session(member.user, setup.actor.organization, DeviceInfo(uuid4()))
    pending = start_device_session(member.user, setup.actor.organization, DeviceInfo(uuid4()))
    retained = start_device_session(member.user, other, DeviceInfo(uuid4()))
    revoke_session(pending.session, Revocation(RevokeReason.ADMIN_REVOKE, setup.actor.user, True))
    history = FieldEventFactory(
        organization=setup.actor.organization,
        created_by=member.user,
        device=active.session.device,
        device_time=timezone.now() - timedelta(days=1),
    )
    original = (
        history.created_by_id,
        history.status,
        history.device_time,
        history.server_received_at,
    )

    client = APIClient()
    client.force_authenticate(setup.actor.user)
    response = client.post(
        f"/api/v1/users/{member.user_id}/deactivate/",
        {"expected_revision": person.revision},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["is_active"] is False

    member.refresh_from_db()
    member.user.refresh_from_db()
    elsewhere.refresh_from_db()
    retained.session.refresh_from_db()
    history.refresh_from_db()
    assert not member.is_active
    assert member.user.is_active
    assert elsewhere.is_active
    scoped = DeviceSession.objects.filter(user=member.user, organization=setup.actor.organization)
    assert not scoped.filter(revoked_at__isnull=True).exists()
    assert not scoped.filter(final_upload_deadline__isnull=False).exists()
    assert retained.session.revoked_at is None
    assert original == (
        history.created_by_id,
        history.status,
        history.device_time,
        history.server_received_at,
    )
    assert AccessLog.objects.filter(target=person, action=AccessLog.Action.DEACTIVATE).count() == 1


@pytest.mark.django_db(transaction=True)
def test_normalized_duplicate_is_org_scoped_and_rotation_preserves_duplicate_identity(
    setup, settings
):
    person, member = make_person(setup.actor, setup.center, rfc=" test-000101-aa0 ")
    fingerprint, ciphertext = person.rfc_fingerprint, bytes(person.rfc_ciphertext)
    before = AccessLog.objects.count()

    with pytest.raises(FieldValidationError) as duplicate:
        make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)

    assert duplicate.value.fields == {"rfc": [{"code": "duplicate", "params": {}}]}
    assert Personnel.objects.filter(organization=setup.actor.organization).count() == 1
    assert AccessLog.objects.count() == before + 1
    other = OrganizationFactory()
    foreign_actor, _, _ = make_actor(other)
    foreign_center = Center.objects.create(organization=other, code="OTHER", name="Synthetic other")
    foreign, _ = make_person(foreign_actor, foreign_center, rfc=SYNTHETIC_RFC)
    assert foreign.rfc_fingerprint != fingerprint

    settings.RFC_KMS_KEY_ID = "wrap-v2"
    rotate_personnel_rfc(setup.actor, member.user_id, person.revision)

    person.refresh_from_db()
    assert person.rfc_fingerprint == fingerprint
    assert person.rfc_key_version == "wrap-v2"
    assert bytes(person.rfc_ciphertext) != ciphertext
    assert AccessLog.objects.filter(target=person, action=AccessLog.Action.ROTATE_RFC).count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("action", ["create", "patch"])
@pytest.mark.parametrize("can_reveal", [False, True])
def test_duplicate_rfc_rejection_is_receipted_without_disclosing_to_work_editors(
    setup, action, can_reveal
):
    make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)
    target, member = make_person(setup.actor, setup.center)
    codes = ["user.create", "user.update"] + (["user.reveal_rfc"] if can_reveal else [])
    editor, _, _ = make_actor(setup.actor.organization, codes)
    client = APIClient()
    client.force_authenticate(editor.user)
    before = AccessLog.objects.count()
    committed = []

    def observe_receipt(sender, instance, created, **kwargs):
        if created and instance.created_by_id == editor.user.pk:
            transaction.on_commit(lambda: committed.append(instance.pk))

    post_save.connect(observe_receipt, sender=AccessLog)
    try:
        if action == "create":
            response = client.post(
                "/api/v1/users/",
                {
                    "username": "synthetic-rejected-rfc",
                    "center_id": str(setup.center.pk),
                    "display_name": "Synthetic rejected employee",
                    "rfc": SYNTHETIC_RFC,
                },
                format="json",
            )
        else:
            response = client.patch(
                f"/api/v1/users/{member.user_id}/",
                {"expected_revision": target.revision, "rfc": SYNTHETIC_RFC},
                format="json",
            )
    finally:
        post_save.disconnect(observe_receipt, sender=AccessLog)

    code = "duplicate" if can_reveal else "rejected"
    assert response.status_code == 400
    assert response.data["fields"] == {"rfc": [{"code": code, "params": {}}]}
    assert AccessLog.objects.count() == before + 1
    receipt = AccessLog.objects.get(created_by=editor.user)
    assert committed == [receipt.pk]
    assert receipt.result == "rfc_rejected"
    assert receipt.action == (
        AccessLog.Action.CREATE if action == "create" else AccessLog.Action.UPDATE
    )
    assert receipt.target_id == (None if action == "create" else target.pk)
    assert receipt.center_id == setup.center.pk
    assert receipt.origin == AccessLog.Origin.INTERNAL
    assert SYNTHETIC_RFC not in str(receipt.__dict__)
    assert not User.objects.filter(username="synthetic-rejected-rfc").exists()
    target.refresh_from_db()
    assert target.revision == 1
    assert not target.rfc_ciphertext


@pytest.mark.parametrize(
    ("action", "result"),
    [
        ("user.create", "success"),
        ("user.update", "rfc_rejected"),
        ("user.reveal_rfc", "rfc_rejected"),
    ],
)
def test_only_rejected_creation_receipts_can_omit_the_private_file(setup, action, result):
    with pytest.raises(DatabaseError), transaction.atomic():
        AccessLog.objects.create(
            organization=setup.actor.organization,
            created_by=setup.actor.user,
            center=setup.center,
            target=None,
            action=action,
            origin=AccessLog.Origin.INTERNAL,
            result=result,
            revision=1,
        )

    assert not AccessLog.objects.exists()


def test_normal_and_operational_reads_expose_only_their_documented_personnel_projection(
    setup, caplog
):
    person, member = make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)
    client = APIClient()
    client.force_authenticate(setup.actor.user)

    normal = client.get(f"/api/v1/users/{member.user_id}/")
    operational = client.get("/api/v1/users/operational/")
    access_log = client.get("/api/v1/access-log/")

    assert normal.status_code == operational.status_code == access_log.status_code == 200
    assert normal.data["has_rfc"] is True
    assert normal.data["display_name"] == person.display_name
    projection = operational.data["results"][0]
    assert set(projection) <= {
        "id",
        "personnel_id",
        "display_name",
        "center_id",
        "quadrant_id",
        "work_email",
        "work_phone",
        "is_active",
        "profiles",
        "trainings",
        "devices",
    }
    assert {"profiles", "trainings", "devices"} <= set(projection)
    for response in (normal, operational, access_log):
        rendered = response.content.decode()
        assert SYNTHETIC_RFC not in rendered
        assert "rfc_ciphertext" not in rendered
        assert "rfc_fingerprint" not in rendered
        assert "rfc_wrapped_key" not in rendered
        assert "evaluations" not in rendered
    assert SYNTHETIC_RFC not in caplog.text


@pytest.mark.django_db(transaction=True)
def test_reveal_requires_its_own_permission_and_commits_receipt_before_no_store_reply(
    setup, monkeypatch
):
    person, member = make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)
    reader, _, _ = make_actor(setup.actor.organization, ["user.read"])
    client = APIClient()
    client.force_authenticate(reader.user)
    url = f"/api/v1/users/{member.user_id}/reveal-rfc/"
    assert client.post(url).status_code == 403
    assert not AccessLog.objects.filter(target=person, action=AccessLog.Action.REVEAL_RFC).exists()
    committed = []
    real_receipt = personnel_services._receipt

    def observe_commit(actor, target, action):
        real_receipt(actor, target, action)
        transaction.on_commit(lambda: committed.append(action))

    monkeypatch.setattr(personnel_services, "_receipt", observe_commit)
    client.force_authenticate(setup.actor.user)

    response = client.post(url)

    assert response.status_code == 200
    assert response.data == {"rfc": SYNTHETIC_RFC}
    assert "no-store" in response["Cache-Control"]
    assert committed == [AccessLog.Action.REVEAL_RFC]
    receipt = AccessLog.objects.get(target=person, action=AccessLog.Action.REVEAL_RFC)
    assert receipt.created_by_id == setup.actor.user.pk
    assert receipt.organization_id == setup.actor.organization.pk
    assert receipt.result == "success"
    assert SYNTHETIC_RFC not in str(receipt.__dict__)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("failure", ["receipt", "key_service", "permission_loss"])
def test_reveal_fails_closed_without_success_receipt(setup, monkeypatch, failure):
    person, member = make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)
    expected = DatabaseError
    if failure == "receipt":

        def reject_receipt(*args):
            raise DatabaseError("Synthetic receipt storage failure")

        monkeypatch.setattr(personnel_services, "_receipt", reject_receipt)
    else:
        decrypt = personnel_services.decrypt_rfc

        def change_authority(*args):
            if failure == "key_service":
                raise RfcKeyUnavailableError
            plaintext = decrypt(*args)
            setup.profile.permission_codes = ["user.read"]
            setup.profile.save(update_fields=["permission_codes"])
            return plaintext

        monkeypatch.setattr(personnel_services, "decrypt_rfc", change_authority)
        expected = RfcKeyUnavailableError if failure == "key_service" else NotFound

    with pytest.raises(expected):
        reveal_personnel_rfc(setup.actor, member.user_id)

    assert not AccessLog.objects.filter(target=person, action=AccessLog.Action.REVEAL_RFC).exists()


@pytest.mark.django_db(transaction=True)
def test_reveal_refuses_an_outer_transaction_that_could_rollback_its_receipt(setup):
    person, member = make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)

    with transaction.atomic(), pytest.raises(RuntimeError, match="durable"):
        reveal_personnel_rfc(setup.actor, member.user_id)

    assert not AccessLog.objects.filter(target=person, action=AccessLog.Action.REVEAL_RFC).exists()


def test_access_receipts_are_append_only_even_outside_the_model_manager(setup):
    person, _ = make_person(setup.actor, setup.center)
    receipt = AccessLog.objects.get(target=person)

    for statement in (
        "UPDATE accounts_accesslog SET result = %s WHERE id = %s",
        "DELETE FROM accounts_accesslog WHERE result = %s AND id = %s",
    ):
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(statement, ["success", receipt.pk])

    assert AccessLog.objects.filter(pk=receipt.pk, result="success").exists()


def test_personnel_endpoint_default_denies_and_filters_org_center_and_quadrant_before_paging(setup):
    quadrant = Quadrant.objects.create(
        organization=setup.actor.organization, center=setup.center, code="SYNTHETIC-Q"
    )
    other_quadrant = Quadrant.objects.create(
        organization=setup.actor.organization, center=setup.center, code="OTHER-Q"
    )
    _, allowed_member = make_person(setup.actor, setup.center, quadrant_id=quadrant.pk)
    _, hidden_quadrant_member = make_person(
        setup.actor, setup.center, quadrant_id=other_quadrant.pk
    )
    other_center = Center.objects.create(
        organization=setup.actor.organization, code="OTHER-C", name="Synthetic restricted center"
    )
    _, hidden_center_member = make_person(setup.actor, other_center)
    foreign_actor, _, _ = make_actor(OrganizationFactory())
    foreign_center = Center.objects.create(
        organization=foreign_actor.organization, code="FOREIGN-C", name="Synthetic foreign center"
    )
    _, foreign_member = make_person(foreign_actor, foreign_center)
    reader, reader_member, profile = make_actor(setup.actor.organization, [])
    client = APIClient()
    client.force_authenticate(reader.user)
    assert client.get("/api/v1/users/").status_code == 403
    profile.permission_codes = ["user.read"]
    profile.save(update_fields=["permission_codes"])
    reader_member.scope = {
        "centers": {"mode": "selected", "ids": [str(setup.center.pk)]},
        "quadrants": {"mode": "selected", "ids": [str(quadrant.pk)]},
    }
    reader_member.save(update_fields=["scope"])

    response = client.get("/api/v1/users/?page_size=1")

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert str(response.data["results"][0]["id"]) == str(allowed_member.user_id)
    for hidden in (hidden_quadrant_member, hidden_center_member, foreign_member):
        assert client.get(f"/api/v1/users/{hidden.user_id}/").status_code == 404
    assert client.get(f"/api/v1/users/{allowed_member.user_id}/").status_code == 200


def test_create_and_edit_api_keep_shared_identity_and_other_membership_unprivileged_and_unchanged(
    setup,
):
    client = APIClient()
    client.force_authenticate(setup.actor.user)
    response = client.post(
        "/api/v1/users/",
        {
            "username": "synthetic-people-login",
            "display_name": "Synthetic original name",
            "center_id": str(setup.center.pk),
            "rfc": SYNTHETIC_RFC,
        },
        format="json",
    )

    assert response.status_code == 201
    person = Personnel.objects.get(pk=response.data["personnel_id"])
    user = person.membership.user
    assert user.username == "synthetic-people-login"
    assert not user.has_usable_password()
    assert not user.is_staff
    assert not user.is_superuser
    assert not person.membership.profiles.exists()
    assert person.membership.scope == {
        "centers": {"mode": "none", "ids": []},
        "quadrants": {"mode": "none", "ids": []},
    }
    other_member = MembershipFactory(
        user=user, organization=OrganizationFactory(), scope=all_scope()
    )
    identity = (user.username, user.email, user.first_name, user.last_name, user.password)
    fingerprint = person.rfc_fingerprint
    url = f"/api/v1/users/{user.pk}/"

    edited = client.patch(
        url,
        {
            "expected_revision": response.data["revision"],
            "display_name": "Synthetic edited name",
            "work_email": "edited-work@example.test",
            "work_phone": "synthetic-edited-contact",
            "rfc": "TEST000102AA0",
        },
        format="json",
    )

    assert edited.status_code == 200
    person.refresh_from_db()
    user.refresh_from_db()
    other_member.refresh_from_db()
    assert person.display_name == "Synthetic edited name"
    assert person.work_email == "edited-work@example.test"
    assert person.work_phone == "synthetic-edited-contact"
    assert person.rfc_fingerprint != fingerprint
    assert identity == (user.username, user.email, user.first_name, user.last_name, user.password)
    assert other_member.is_active
    assert other_member.scope == all_scope()
    assert other_member.revision == 1
    receipt_count = AccessLog.objects.filter(target=person).count()

    stale = client.patch(
        url,
        {"expected_revision": response.data["revision"], "display_name": "Stale synthetic edit"},
        format="json",
    )

    assert (stale.status_code, stale.data["code"]) == (409, "stale_revision")
    person.refresh_from_db()
    assert person.display_name == "Synthetic edited name"
    assert AccessLog.objects.filter(target=person).count() == receipt_count
    assert "TEST000102AA0" not in edited.content.decode()


@pytest.mark.parametrize("reference", ["foreign", "unknown"])
def test_personnel_creation_refuses_foreign_or_unknown_membership_without_creating_identity(
    setup, reference
):
    foreign = MembershipFactory()
    membership_id = foreign.pk if reference == "foreign" else uuid4()
    user_count, personnel_count, receipt_count = (
        User.objects.count(),
        Personnel.objects.count(),
        AccessLog.objects.count(),
    )

    with pytest.raises(NotFound):
        create_personnel(
            setup.actor,
            {
                "membership_id": membership_id,
                "center_id": setup.center.pk,
                "display_name": "Synthetic inaccessible employee",
            },
        )

    assert User.objects.count() == user_count
    assert Personnel.objects.count() == personnel_count
    assert AccessLog.objects.count() == receipt_count


@pytest.mark.parametrize("authorized_context", ["old", "new"])
def test_editing_personnel_context_requires_authority_over_both_old_and_new_contexts(
    setup, authorized_context
):
    person, member = make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)
    destination = Center.objects.create(
        organization=setup.actor.organization, code="DESTINATION", name="Synthetic destination"
    )
    editor, editor_member, _ = make_actor(setup.actor.organization, ["user.update"])
    authorized_center = setup.center if authorized_context == "old" else destination
    editor_member.scope = {
        "centers": {"mode": "selected", "ids": [str(authorized_center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    editor_member.save(update_fields=["scope"])
    original = (
        person.center_id,
        person.display_name,
        person.revision,
        bytes(person.rfc_ciphertext),
    )
    receipt_count = AccessLog.objects.filter(target=person).count()

    with pytest.raises(NotFound):
        update_personnel(
            editor,
            member.user_id,
            {
                "expected_revision": person.revision,
                "center_id": destination.pk,
                "display_name": "Synthetic moved name",
                "rfc": "TEST000102AA0",
            },
        )

    person.refresh_from_db()
    assert original == (
        person.center_id,
        person.display_name,
        person.revision,
        bytes(person.rfc_ciphertext),
    )
    assert AccessLog.objects.filter(target=person).count() == receipt_count


@pytest.mark.parametrize("change_after_preflight", ["permission_loss", "context_move"])
def test_session_revocation_rechecks_permission_and_target_context_after_http_preflight(
    setup, monkeypatch, change_after_preflight
):
    person, member = make_person(setup.actor, setup.center)
    issued = start_device_session(member.user, setup.actor.organization, DeviceInfo(uuid4()))
    revoker, revoker_member, profile = make_actor(
        setup.actor.organization, ["user.revoke_device_sessions"]
    )
    revoker_member.scope = {
        "centers": {"mode": "selected", "ids": [str(setup.center.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    revoker_member.save(update_fields=["scope"])
    destination = Center.objects.create(
        organization=setup.actor.organization, code="REVOKE-DEST", name="Synthetic moved center"
    )
    real_revoke = views.revoke_scoped_personnel_sessions
    reached_service = []

    def change_then_revoke(actor, user_id, allow_final_upload):
        reached_service.append(change_after_preflight)
        if change_after_preflight == "permission_loss":
            profile.permission_codes = []
            profile.save(update_fields=["permission_codes"])
        else:
            update_personnel(
                setup.actor,
                member.user_id,
                {"expected_revision": person.revision, "center_id": destination.pk},
            )
        return real_revoke(actor, user_id, allow_final_upload)

    monkeypatch.setattr(views, "revoke_scoped_personnel_sessions", change_then_revoke)
    client = APIClient()
    client.force_authenticate(revoker.user)

    response = client.post(f"/api/v1/users/{member.user_id}/revoke-device-sessions/")

    assert reached_service == [change_after_preflight]
    assert (response.status_code, response.data["code"]) == (404, "not_found")
    issued.session.refresh_from_db()
    assert issued.session.revoked_at is None
    assert issued.session.final_upload_deadline is None


def test_center_scoped_operational_and_access_log_reads_include_inapplicable_null_quadrant(setup):
    person, member = make_person(setup.actor, setup.center)
    viewer, viewer_member, _ = make_actor(
        setup.actor.organization, ["access_log.read", "user.operational_read"]
    )
    viewer_member.scope = {
        "centers": {"mode": "selected", "ids": [str(setup.center.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    viewer_member.save(update_fields=["scope"])
    client = APIClient()
    client.force_authenticate(viewer.user)

    access_log = client.get("/api/v1/access-log/")
    operational = client.get("/api/v1/users/operational/")

    assert access_log.status_code == operational.status_code == 200
    assert [str(row["target_id"]) for row in access_log.data["results"]] == [str(person.pk)]
    assert [str(row["id"]) for row in operational.data["results"]] == [str(member.user_id)]
    assert access_log.data["results"][0]["quadrant_id"] is None
    assert operational.data["results"][0]["quadrant_id"] is None


@pytest.mark.django_db(transaction=True)
def test_operational_training_marks_scheduled_revocation_only_at_its_effective_boundary(
    org_a, make_member, monkeypatch, settings, tmp_path
):
    from people.permissions import PeopleContext
    from tests.people_support import certify, people_context, training_version, write_person

    context = people_context(org_a, make_member, monkeypatch, settings, tmp_path)
    context.context = PeopleContext(context.center.pk, None)
    context.profile.permission_codes.append("user.create")
    # Filing an account requires holding all of its permissions (account authority rule).
    context.profile.permission_codes.extend(context.subject.profiles.get().permission_codes)
    context.profile.save(update_fields=["permission_codes"])
    create_personnel(
        context.actor,
        {
            "membership_id": context.subject.pk,
            "center_id": context.center.pk,
            "display_name": "Synthetic trained employee",
        },
    )
    version = training_version(context)
    certificate = certify(context, version)
    boundary = context.clock["now"] + timedelta(days=1)
    write_person(
        context,
        "certification.revoke",
        {
            "expected_revision": 1,
            "effective_from": boundary,
            "reason_code": "other",
            "reason": "Synthetic scheduled qualification withdrawal",
        },
        target=UUID(certificate["id"]),
    )
    viewer, viewer_member, _ = make_actor(org_a, ["user.operational_read", "training.read"])
    viewer_member.scope = {
        "centers": {"mode": "selected", "ids": [str(context.center.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    viewer_member.save(update_fields=["scope"])
    client = APIClient()
    client.force_authenticate(viewer.user)
    context.clock["now"] = boundary - timedelta(microseconds=1)

    before = client.get("/api/v1/users/operational/")
    context.clock["now"] = boundary
    effective = client.get("/api/v1/users/operational/")

    assert before.status_code == effective.status_code == 200
    original_summary = before.data["results"][0]["trainings"][0]
    effective_summary = effective.data["results"][0]["trainings"][0]
    assert original_summary["training_code"] == version.training.code
    assert original_summary["is_revoked"] is False
    assert effective_summary["is_revoked"] is True
