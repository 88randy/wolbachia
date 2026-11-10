"""Demo personnel files for W48/W49 (writes Personnel). Synthetic names, no RFC (DEV-ONLY)."""

from accounts.models import Personnel
from organizations.demo_seed.people import DEMO_USERS
from organizations.models import Center, Membership, Organization


def ensure_personnel(
    organization: Organization, members: dict[str, Membership], centers: list[Center]
) -> None:
    """Get or create one personnel file per demo membership, spread over the demo centers."""
    ordered = sorted(centers, key=lambda center: center.code)
    for index, person in enumerate(DEMO_USERS):
        member = members.get(person.username)
        if member is None or not ordered:
            continue
        Personnel.objects.get_or_create(
            membership=member,
            defaults={
                "organization": organization,
                "center": ordered[index % len(ordered)],
                "display_name": f"{person.first_name} {person.last_name}",
                "work_email": f"{person.username}@demo.invalid",
                "created_by": members["demo-admin"].user,
            },
        )
