"""Historical configuration proof is separate from current reviewer authentication."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from organizations.models import ConfigurationRevision, Organization, Profile
from organizations.scope import EffectiveScope, safe_scope
from organizations.services import fold_profile_scope


@dataclass(frozen=True)
class HistoricalAuthority:
    scope: EffectiveScope
    proof_ids: tuple[str, ...]
    unavailable: str | None = None


def historical_authority(
    organization: Organization, user_id: UUID | None, captured_at: datetime
) -> HistoricalAuthority:
    rows = ConfigurationRevision.objects.filter(
        organization=organization, created_at__lte=captured_at
    )
    member = (
        rows.filter(kind="membership", snapshot__user=str(user_id))
        .order_by("-created_at", "-revision", "-id")
        .first()
    )
    if member is None or not member.snapshot.get("is_active"):
        return HistoricalAuthority(EffectiveScope(()), (), "authority_history_unavailable")
    profiles = []
    proofs = [str(member.pk)]
    member_scope = safe_scope(member.snapshot.get("scope"))
    for identifier in member.snapshot.get("profiles", []):
        role = (
            rows.filter(kind="role", target_id=identifier)
            .order_by("-created_at", "-revision", "-id")
            .first()
        )
        if role is None:
            return HistoricalAuthority(EffectiveScope(()), (), "authority_history_unavailable")
        proofs.append(str(role.pk))
        if role.snapshot.get("is_active"):
            slug = role.snapshot.get("slug")
            if not isinstance(slug, str) or not slug:
                return HistoricalAuthority(EffectiveScope(()), (), "authority_history_unavailable")
            profiles.append(
                Profile(
                    slug=slug,
                    permission_codes=role.snapshot.get("permissions", []),
                    scope=safe_scope(role.snapshot.get("scope")),
                    is_active=True,
                )
            )
    return HistoricalAuthority(fold_profile_scope(member_scope, profiles), tuple(proofs))
