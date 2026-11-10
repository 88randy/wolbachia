"""Demo organization, centers and one synthetic user per profile (writes several tables).

Everything here is synthetic and DEV-ONLY. The passwords below exist only so a developer can log
in on a local database; they are never valid anywhere else and `seed_demo` refuses to run outside
local settings.
"""

from dataclasses import dataclass

from django.db import transaction

from accounts.models import User
from accounts.services import create_user_without_password
from organizations.models import Center, Membership, Organization, Profile, all_scope
from organizations.scope import normalize_scope
from organizations.services import (
    AdminSpec,
    MembershipChange,
    OrganizationSpec,
    bootstrap_organization,
    create_membership,
    update_membership,
)

DEMO_SLUG = "demo"
DEMO_ORGANIZATION = OrganizationSpec(
    name="Programa Wolbachia Mérida",
    slug=DEMO_SLUG,
    country="MX",
    timezone="America/Merida",
    languages=("es-MX", "en"),
)
CENTER_CODES = (
    ("C-DEMO-01", "Base Centro-Oriente"),
    ("C-DEMO-02", "Base Poniente-Norte"),
)


@dataclass(frozen=True)
class DemoUser:
    username: str
    profile: str
    first_name: str
    last_name: str
    password: str  # DEV-ONLY, documented fixed list; see module docstring.


# Fixed DEV-ONLY passwords, one per user. Fully synthetic people: invented combinations of common
# Mexican (Yucatecan) names and surnames, no RFC and no real person.
DEMO_USERS = (
    DemoUser("demo-admin", "admin", "Ada", "Admin", "Demo-Admin-Local-2026"),
    DemoUser(
        "demo-supervisor", "supervisor", "Sergio Alberto", "Medina Cetina", "Demo-Super-Local-2026"
    ),
    DemoUser("demo-supervisor-2", "supervisor", "Mónica", "Pacheco Ruiz", "Demo-Super2-Local-2026"),
    DemoUser("demo-courier-1", "courier", "Carlos", "Canul Pech", "Demo-Courier1-Local-2026"),
    DemoUser("demo-courier-2", "courier", "Mario", "Chan Euán", "Demo-Courier2-Local-2026"),
    DemoUser("demo-courier-3", "courier", "Luis Enrique", "May Poot", "Demo-Courier3-Local-2026"),
    DemoUser("demo-courier-4", "courier", "Jorge", "Dzul Tun", "Demo-Courier4-Local-2026"),
    DemoUser("demo-courier-5", "courier", "Yesenia", "Uc Cauich", "Demo-Courier5-Local-2026"),
    DemoUser("demo-courier-6", "courier", "Diana Laura", "Ek Balam", "Demo-Courier6-Local-2026"),
    DemoUser(
        "demo-entomologist", "entomologist", "Elena", "Vargas Solís", "Demo-Entomo-Local-2026"
    ),
    DemoUser(
        "demo-entomologist-2",
        "entomologist",
        "Ricardo",
        "Aguilar Peniche",
        "Demo-Entomo2-Local-2026",
    ),
    DemoUser(
        "demo-promoter", "community_promoter", "Paula", "Góngora Cruz", "Demo-Promo-Local-2026"
    ),
    DemoUser("demo-coordinator", "coordinator", "Cora", "Escalante Báez", "Demo-Coord-Local-2026"),
    DemoUser("demo-warehouse", "warehouse", "Walter", "Rosado Lara", "Demo-Wareh-Local-2026"),
    DemoUser("demo-regulatory", "regulatory", "Regina", "Cervera Ortiz", "Demo-Regul-Local-2026"),
    DemoUser("demo-government", "government", "Gael", "Herrera Sosa", "Demo-Govern-Local-2026"),
)
COURIER_USERNAMES = tuple(user.username for user in DEMO_USERS if user.profile == "courier")


def ensure_organization() -> Organization:
    """Reuse the demo organization or bootstrap it with its admin user (writes)."""
    existing = Organization.objects.filter(slug=DEMO_SLUG).first()
    if existing is not None:
        _rename_organization(existing)
        return existing
    admin = DEMO_USERS[0]
    organization, _ = bootstrap_organization(
        DEMO_ORGANIZATION,
        AdminSpec(username=admin.username, email=f"{admin.username}@example.test"),
    )
    return organization


def _rename_organization(organization: Organization) -> None:
    """Upgrade an organization seeded by the first demo version (same slug, new display name)."""
    if organization.name != DEMO_ORGANIZATION.name:
        organization.name = DEMO_ORGANIZATION.name
        organization.timezone = DEMO_ORGANIZATION.timezone
        organization.save(update_fields=["name", "timezone"])


def ensure_centers(organization: Organization, admin: User) -> list[Center]:
    """Get or create the demo centers and give them their current names (writes Center)."""
    centers = []
    for code, name in CENTER_CODES:
        center, _ = Center.objects.get_or_create(
            organization=organization, code=code, defaults={"name": name, "created_by": admin}
        )
        if center.name != name:
            center.name = name
            center.save(update_fields=["name"])
        centers.append(center)
    return centers


def _ensure_user(spec: DemoUser, reset_passwords: bool) -> User:
    user = User.objects.filter(username=spec.username).first()
    if user is None:
        user = create_user_without_password(spec.username, f"{spec.username}@example.test")
        reset_passwords = True
    if reset_passwords or not user.has_usable_password():
        user.set_password(spec.password)
    user.first_name = spec.first_name
    user.last_name = spec.last_name
    user.save()
    return user


def _ensure_member(user: User, profile: Profile, admin: User) -> None:
    organization = profile.organization
    membership = Membership.objects.filter(user=user, organization=organization).first()
    if membership is None:
        with transaction.atomic():
            membership = create_membership(user, organization, [profile])
    if membership.scope == all_scope() and list(membership.profiles.all()) == [profile]:
        return
    update_membership(
        membership,
        MembershipChange(
            actor=admin,
            expected_revision=membership.revision,
            profiles=[profile],
            scope=normalize_scope(all_scope()),
        ),
    )


def ensure_users(
    organization: Organization, reset_passwords: bool
) -> dict[str, tuple[User, Membership]]:
    """One user and membership per demo profile, by username (writes User, Membership)."""
    admin = User.objects.get(username=DEMO_USERS[0].username)
    profiles = {p.slug: p for p in Profile.objects.filter(organization=organization)}
    result: dict[str, tuple[User, Membership]] = {}
    for spec in DEMO_USERS:
        user = _ensure_user(spec, reset_passwords)
        _ensure_member(user, profiles[spec.profile], admin)
        result[spec.username] = (user, Membership.objects.get(user=user, organization=organization))
    return result
