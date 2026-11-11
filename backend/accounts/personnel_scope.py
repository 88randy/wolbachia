"""Personnel mutations must cover the linked membership's real paired authority."""

from rest_framework.exceptions import NotFound

from accounts.models import Personnel
from organizations.models import Membership
from organizations.services import effective_scope, require_account_authority
from uploads.access import UploadActor


def authorize_membership_scope(actor: UploadActor, permission: str, target: Membership) -> None:
    """Recheck under the caller's organization lock; chosen work context grants no ownership.

    Without a private file there is no trusted personnel context, matching the
    existing org-wide-only session-revocation rule. Every target is additionally
    checked by `require_account_authority`: its permissions are a subset of the
    caller's and each of its grants lies inside a caller grant carrying `permission`.
    The caller still authorizes the file's actual and proposed work contexts.
    """
    members = Membership.objects.filter(organization=actor.organization).select_related(
        "user", "organization"
    )
    member = members.filter(user_id=actor.user.pk).first()
    current_target = members.filter(pk=target.pk).first()
    if member is None or current_target is None:
        raise NotFound
    actor_effective = effective_scope(member)
    grants = [scope for codes, scope in actor_effective.grants if permission in codes]
    unfiled = not Personnel.objects.filter(
        membership=current_target, organization=actor.organization
    ).exists()
    if unfiled and not any(
        scope["centers"]["mode"] == scope["quadrants"]["mode"] == "all" for scope in grants
    ):
        raise NotFound
    # Never act on an account that holds more than the caller (e.g. HR resetting an admin).
    require_account_authority(actor_effective, current_target, permission)
