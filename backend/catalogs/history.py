"""Archive exact delivered catalog content without rewriting history."""

from typing import Any

from accounts.models import User
from catalogs.models import CatalogSnapshot
from organizations.models import Organization


def remember_catalog_snapshot(
    organization: Organization, author: User, snapshot: dict[str, Any]
) -> CatalogSnapshot:
    """Insert the hash once; concurrent readers converge on the same immutable snapshot."""
    archived, _created = CatalogSnapshot.objects.get_or_create(
        organization=organization,
        version=snapshot["version"],
        defaults={"created_by": author, "content": snapshot},
    )
    return archived
