"""Acting on another account never reaches beyond the actor's own permissions and scope."""

import pytest
from rest_framework.exceptions import NotFound

from accounts.models import AccessLog, User
from accounts.personnel_services import (
    deactivate_personnel,
    issue_temporary_password,
    update_personnel,
)
from organizations.models import Center, Membership, Profile, all_scope
from organizations.services import MembershipChange, update_membership
from tests.factories import ProfileFactory
from tests.test_accounts_b_02 import (
    make_actor,
    make_person,
    setup,  # noqa: F401 -- shared fixture
)

pytestmark = pytest.mark.django_db

ADMIN_CODES = ["organization.update", "role.update", "role.read", "user.update"]


def make_admin_person(setup):  # noqa: F811
    person, member = make_person(setup.actor, setup.center)
    member.profiles.add(
        ProfileFactory(
            organization=setup.actor.organization, permission_codes=ADMIN_CODES, scope=all_scope()
        )
    )
    return person, member


def test_hr_profile_cannot_issue_a_password_for_an_admin(setup):  # noqa: F811
    _person, admin = make_admin_person(setup)
    before = User.objects.get(pk=admin.user_id).password

    with pytest.raises(NotFound):
        issue_temporary_password(setup.actor, admin.user_id)

    assert User.objects.get(pk=admin.user_id).password == before


def test_hr_profile_cannot_edit_or_deactivate_an_admin(setup):  # noqa: F811
    person, admin = make_admin_person(setup)

    with pytest.raises(NotFound):
        update_personnel(setup.actor, admin.user_id, {"display_name": "Taken over"})
    with pytest.raises(NotFound):
        deactivate_personnel(setup.actor, admin.user_id, person.revision, "Left the organization")

    assert Membership.objects.get(pk=admin.pk).is_active


def test_hr_profile_still_issues_a_password_within_its_authority(setup):  # noqa: F811
    _person, member = make_person(setup.actor, setup.center)

    password = issue_temporary_password(setup.actor, member.user_id)

    assert User.objects.get(pk=member.user_id).check_password(password)
    assert AccessLog.objects.filter(action=AccessLog.Action.TEMPORARY_PASSWORD).count() == 1


def test_target_outside_the_actors_centers_is_opaque(setup):  # noqa: F811
    other = Center.objects.create(
        organization=setup.actor.organization, code="OTHER", name="Synthetic other center"
    )
    _person, member = make_person(setup.actor, setup.center)
    member.profiles.add(
        ProfileFactory(
            organization=setup.actor.organization,
            permission_codes=["user.read"],
            scope={
                "centers": {"mode": "selected", "ids": [str(other.pk)]},
                "quadrants": {"mode": "all", "ids": []},
            },
        )
    )
    limited, actor_member, _ = make_actor(setup.actor.organization, ["user.update", "user.read"])
    actor_member.scope = {
        "centers": {"mode": "selected", "ids": [str(setup.center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    actor_member.save(update_fields=["scope"])

    with pytest.raises(NotFound):
        issue_temporary_password(limited, member.user_id)


def test_role_manager_cannot_change_an_admins_membership(setup):  # noqa: F811
    _person, admin = make_admin_person(setup)
    manager, _member, _profile = make_actor(setup.actor.organization, ["role.update"])
    reader = Profile.objects.create(
        organization=setup.actor.organization,
        slug="reader",
        label_es="Lector",
        label_en="Reader",
        permission_codes=[],
        scope=all_scope(),
    )

    with pytest.raises(NotFound):
        update_membership(
            admin,
            MembershipChange(
                actor=manager.user,
                expected_revision=admin.revision,
                profiles=[reader],
                scope=all_scope(),
            ),
        )

    assert admin.profiles.filter(permission_codes__contains=["role.update"]).exists()
