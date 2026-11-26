import pytest
from django.utils import timezone

from field_sync.permissions import FIELD_BOOTSTRAP
from geography.models import Quadrant, QuadrantVersion
from organizations.models import Center
from tests.sync_support import make_phone

ZONES = "/api/v1/field/zones/"
RING = [[-89.6, 20.9], [-89.5, 20.9], [-89.5, 21.0], [-89.6, 21.0], [-89.6, 20.9]]


def _quadrant(org, code):
    center = Center.objects.create(organization=org, code=f"C-{code}", name=f"Center {code}")
    quadrant = Quadrant.objects.create(organization=org, center=center, code=code)
    QuadrantVersion.objects.create(
        organization=org,
        quadrant=quadrant,
        geometry={"type": "Polygon", "coordinates": [RING]},
        revision=1,
        effective_from=timezone.now(),
    )
    return quadrant


@pytest.mark.django_db
def test_zones_return_only_quadrants_in_scope(org_a, make_member):
    phone = make_phone(make_member, org_a, (FIELD_BOOTSTRAP,))
    inside = _quadrant(org_a, "Q-IN")
    _quadrant(org_a, "Q-OUT")
    membership = phone.user.memberships.get(organization=org_a)
    scope = {
        "centers": {"mode": "all", "ids": []},
        "quadrants": {"mode": "selected", "ids": [str(inside.pk)]},
    }
    membership.scope = scope
    membership.save(update_fields=["scope"])
    profile = membership.profiles.get()
    profile.scope = scope
    profile.save(update_fields=["scope"])
    response = phone.client.get(ZONES)
    assert response.status_code == 200
    assert [zone["code"] for zone in response.json()] == ["Q-IN"]
    assert response.json()[0]["ring"][0] == RING[0]


@pytest.mark.django_db
def test_zones_require_the_bootstrap_permission(org_a, make_member):
    phone = make_phone(make_member, org_a, ())
    assert phone.client.get(ZONES).status_code == 403
