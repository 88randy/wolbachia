"""A private file's chosen center cannot hide its membership's effective authority."""

from uuid import uuid4

import pytest
from rest_framework.exceptions import NotFound

from accounts.models import AccessLog, Personnel
from accounts.personnel_services import (
    create_personnel,
    deactivate_personnel,
    revoke_scoped_personnel_sessions,
    update_personnel,
)
from accounts.services import DeviceInfo, start_device_session
from organizations.models import Center, Membership, all_scope
from tests.factories import MembershipFactory, ProfileFactory
from tests.test_accounts_b_02 import make_actor, make_person
from tests.test_accounts_b_02 import setup as setup

pytestmark = pytest.mark.django_db

MUTATION_CODES = ["user.create", "user.update", "user.deactivate", "user.revoke_device_sessions"]


def center_scope(center):
    return {
        "centers": {"mode": "selected", "ids": [str(center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }


def scoped_admin(setup):
    actor, member, _ = make_actor(setup.actor.organization, MUTATION_CODES)
    member.scope = center_scope(setup.center)
    member.save(update_fields=["scope"])
    return actor


def target_scope(setup, scope_kind):
    if scope_kind == "all":
        return all_scope()
    center = Center.objects.create(
        organization=setup.actor.organization, code="OUTSIDE", name="Synthetic outside center"
    )
    return center_scope(center)


@pytest.mark.parametrize("scope_kind", ["outside", "all"])
def test_center_admin_cannot_attach_unfiled_membership_using_a_chosen_local_center(
    setup, scope_kind
):
    actor = scoped_admin(setup)
    member = MembershipFactory(
        organization=setup.actor.organization, scope=target_scope(setup, scope_kind)
    )
    member.profiles.add(
        ProfileFactory(
            organization=setup.actor.organization,
            permission_codes=["field_event.sync"],
            scope=all_scope(),
        )
    )
    receipts = AccessLog.objects.count()

    with pytest.raises(NotFound):
        create_personnel(
            actor,
            {
                "membership_id": member.pk,
                "center_id": setup.center.pk,
                "display_name": "Synthetic attempted scope takeover",
            },
        )

    assert not Personnel.objects.filter(membership=member).exists()
    assert AccessLog.objects.count() == receipts


@pytest.mark.parametrize("scope_kind", ["outside", "all"])
@pytest.mark.parametrize("operation", ["patch", "deactivate", "revoke"])
def test_membership_scope_prevents_mutation_through_a_misleading_local_personnel_context(
    setup, scope_kind, operation
):
    person, member = make_person(setup.actor, setup.center)
    member.scope = target_scope(setup, scope_kind)
    member.save(update_fields=["scope"])
    member.profiles.add(
        ProfileFactory(
            organization=setup.actor.organization,
            permission_codes=["field_event.sync"],
            scope=all_scope(),
        )
    )
    session = start_device_session(
        member.user, setup.actor.organization, DeviceInfo(uuid4())
    ).session
    actor = scoped_admin(setup)
    receipts = AccessLog.objects.count()

    def attempt_mutation():
        if operation == "patch":
            update_personnel(
                actor,
                member.user_id,
                {"expected_revision": person.revision, "work_phone": "synthetic-attempted-edit"},
            )
        elif operation == "deactivate":
            deactivate_personnel(actor, member.user_id, person.revision, "Left the organization")
        else:
            revoke_scoped_personnel_sessions(actor, member.user_id, False)

    with pytest.raises(NotFound):
        attempt_mutation()

    person.refresh_from_db()
    member.refresh_from_db()
    session.refresh_from_db()
    assert person.revision == 1
    assert person.work_phone == "synthetic-work-contact"
    assert member.is_active
    assert session.revoked_at is None
    assert AccessLog.objects.count() == receipts


@pytest.mark.parametrize("has_profile", [False, True])
def test_center_admin_can_update_a_local_personnel_file_without_wider_effective_scope(
    setup, has_profile
):
    person, member = make_person(setup.actor, setup.center)
    if has_profile:
        member.scope = center_scope(setup.center)
        member.save(update_fields=["scope"])
        member.profiles.add(
            ProfileFactory(
                organization=setup.actor.organization,
                permission_codes=["field_event.sync"],
                scope=all_scope(),
            )
        )

    # The editor holds every permission of the account it edits (account authority rule).
    actor = scoped_admin(setup)
    actor_member = Membership.objects.get(user=actor.user, organization=actor.organization)
    profile = actor_member.profiles.first()
    profile.permission_codes = [*MUTATION_CODES, "field_event.sync"]
    profile.save(update_fields=["permission_codes"])

    updated = update_personnel(
        actor,
        member.user_id,
        {"expected_revision": person.revision, "work_phone": "synthetic-authorized-edit"},
    )

    assert updated.work_phone == "synthetic-authorized-edit"
    assert updated.revision == 2
