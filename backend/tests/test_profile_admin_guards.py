"""Custom profiles by copy and the administrator guard rails (no self-escalation, no lockout)."""

import pytest

from organizations.models import ConfigurationRevision, Profile, all_scope
from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory

pytestmark = pytest.mark.django_db

ADMIN = ["role.read", "role.update", "organization.update", "organization.read"]


def member(organization, codes, scope=None):
    profile = ProfileFactory(organization=organization, permission_codes=codes, scope=all_scope())
    membership = MembershipFactory(organization=organization, scope=scope or all_scope())
    membership.profiles.add(profile)
    return membership, profile


def headers(organization):
    return {"HTTP_X_ORGANIZATION": organization.slug}


def test_admin_copies_a_profile_into_a_new_custom_profile(api_client):
    organization = OrganizationFactory()
    admin, _ = member(organization, ADMIN)
    source = ProfileFactory(
        organization=organization, permission_codes=["role.read"], scope=all_scope()
    )
    api_client.force_authenticate(admin.user)

    response = api_client.post(
        "/api/v1/roles/",
        {"copy_from": str(source.pk), "label_es": "Almacén norte", "label_en": "North store"},
        format="json",
        **headers(organization),
    )

    assert response.status_code == 201
    created = Profile.objects.get(pk=response.json()["id"])
    assert created.slug == "almacen-norte"
    assert created.permission_codes == ["role.read"]
    assert created.created_by_seed is False
    assert ConfigurationRevision.objects.filter(target_id=created.pk, kind="role").exists()


def test_copy_cannot_grant_codes_the_caller_does_not_hold(api_client):
    organization = OrganizationFactory()
    limited, _ = member(organization, ["role.read", "role.update"])
    source = ProfileFactory(
        organization=organization, permission_codes=["user.reveal_rfc"], scope=all_scope()
    )
    api_client.force_authenticate(limited.user)

    response = api_client.post(
        "/api/v1/roles/",
        {"copy_from": str(source.pk), "label_es": "Copia", "label_en": "Copy"},
        format="json",
        **headers(organization),
    )

    assert response.status_code == 403
    assert not Profile.objects.filter(organization=organization, label_es="Copia").exists()


def test_copy_of_another_organizations_profile_is_not_found(api_client):
    organization = OrganizationFactory()
    admin, _ = member(organization, ADMIN)
    foreign = ProfileFactory(organization=OrganizationFactory(), permission_codes=["role.read"])
    api_client.force_authenticate(admin.user)

    response = api_client.post(
        "/api/v1/roles/",
        {"copy_from": str(foreign.pk), "label_es": "Ajeno", "label_en": "Foreign"},
        format="json",
        **headers(organization),
    )

    assert response.status_code == 404


def test_non_admin_cannot_create_profiles(api_client):
    organization = OrganizationFactory()
    reader, profile = member(organization, ["role.read"])
    api_client.force_authenticate(reader.user)

    response = api_client.post(
        "/api/v1/roles/",
        {"copy_from": str(profile.pk), "label_es": "Yo", "label_en": "Me"},
        format="json",
        **headers(organization),
    )

    assert response.status_code == 403


def test_admin_cannot_strip_their_own_profile_even_with_another_admin(api_client):
    organization = OrganizationFactory()
    admin, admin_profile = member(organization, ADMIN)
    member(organization, ADMIN)  # a second administrator exists
    api_client.force_authenticate(admin.user)

    response = api_client.put(
        f"/api/v1/roles/{admin_profile.pk}/permissions/",
        {"permissions": ["role.read"], "scope": all_scope(), "expected_revision": 1},
        format="json",
        **headers(organization),
    )

    assert response.status_code == 409
    assert response.json()["code"] == "own_administration"
    admin_profile.refresh_from_db()
    assert "role.update" in admin_profile.permission_codes


def test_admin_cannot_unassign_their_own_admin_profile(api_client):
    organization = OrganizationFactory()
    admin, _ = member(organization, ADMIN)
    member(organization, ADMIN)
    other = ProfileFactory(organization=organization, permission_codes=["role.read"])
    api_client.force_authenticate(admin.user)

    response = api_client.post(
        f"/api/v1/memberships/{admin.pk}/change-scope/",
        {"expected_revision": admin.revision, "profiles": [str(other.pk)], "scope": all_scope()},
        format="json",
        **headers(organization),
    )

    assert response.status_code == 409
    assert admin.profiles.filter(permission_codes__contains=["role.update"]).exists()


def test_admin_can_still_change_another_admin(api_client):
    organization = OrganizationFactory()
    admin, _ = member(organization, ADMIN)
    second, _ = member(organization, ADMIN)
    reader = ProfileFactory(organization=organization, permission_codes=["role.read"])
    api_client.force_authenticate(admin.user)

    response = api_client.post(
        f"/api/v1/memberships/{second.pk}/change-scope/",
        {"expected_revision": second.revision, "profiles": [str(reader.pk)], "scope": all_scope()},
        format="json",
        **headers(organization),
    )

    assert response.status_code == 200
