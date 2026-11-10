"""People deactivation shares the administration arbiter and closes prepared login races."""

import threading
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from django.db import connection, transaction

from accounts.models import DeviceSession, User
from accounts.services import DeviceInfo, start_device_session
from organizations.exceptions import (
    AdministrationBusyError,
    LastAdministratorError,
    NoActiveMembershipError,
)
from organizations.models import Membership, all_scope, default_scope
from organizations.selectors import resolve_active_membership
from organizations.services import (
    MembershipChange,
    deactivate_personnel_membership,
    update_membership,
)
from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory, UserFactory


@pytest.mark.django_db(transaction=True)
def test_concurrent_people_deactivation_and_role_removal_retain_last_administrator():
    organization = OrganizationFactory()
    profile = ProfileFactory(
        organization=organization,
        permission_codes=["organization.update", "role.update", "user.deactivate"],
        scope=all_scope(),
    )
    members = [MembershipFactory(organization=organization, scope=all_scope()) for _ in range(2)]
    for member in members:
        member.profiles.add(profile)
    barrier = threading.Barrier(2, timeout=10)
    committed = threading.Event()

    def remove(item):
        member_id, deactivate = item
        try:
            member = Membership.objects.select_related("user").get(pk=member_id)
            barrier.wait()

            def apply():
                if deactivate:
                    with transaction.atomic():
                        User.objects.select_for_update(no_key=True).get(pk=member.user_id)
                        deactivate_personnel_membership(member, member.user, member.revision)
                    return
                update_membership(
                    member,
                    MembershipChange(member.user, member.revision, [], default_scope(), False),
                )

            try:
                apply()
            except AdministrationBusyError:
                assert committed.wait(10)
                apply()
        except LastAdministratorError as error:
            return error.code
        else:
            committed.set()
            return "removed"
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(remove, [(members[0].pk, True), (members[1].pk, False)]))

    assert sorted(outcomes) == ["last_administrator", "removed"]
    assert Membership.objects.filter(organization=organization, is_active=True).count() == 1


@pytest.mark.django_db
def test_login_prepared_before_membership_deactivation_cannot_open_a_session():
    organization = OrganizationFactory()
    user = UserFactory()
    member = MembershipFactory(user=user, organization=organization)
    admin = UserFactory()
    administrator = MembershipFactory(user=admin, organization=organization, scope=all_scope())
    administrator.profiles.add(
        ProfileFactory(
            organization=organization,
            permission_codes=["user.deactivate"],
            scope=all_scope(),
        )
    )
    prepared = resolve_active_membership(user, organization.slug)
    with transaction.atomic():
        User.objects.select_for_update(no_key=True).get(pk=user.pk)
        deactivate_personnel_membership(member, admin, member.revision)

    with pytest.raises(NoActiveMembershipError):
        start_device_session(user, prepared.organization, DeviceInfo(uuid4()))

    assert not DeviceSession.objects.filter(user=user, organization=organization).exists()
