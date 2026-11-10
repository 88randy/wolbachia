"""Personnel mutations must cover the linked membership's real paired authority."""

from rest_framework.exceptions import NotFound

from accounts.models import Personnel
from organizations.models import Membership
from organizations.scope import WorkScope
from organizations.services import effective_scope
from uploads.access import UploadActor


def _covers_scope(available: WorkScope, requested: WorkScope) -> bool:
    for granted, required in (
        (available["centers"], requested["centers"]),
        (available["quadrants"], requested["quadrants"]),
    ):
        if required["mode"] == "none" or granted["mode"] == "all":
            continue
        if required["mode"] == "all" or not set(required["ids"]) <= set(granted["ids"]):
            return False
    return True


def authorize_membership_scope(actor: UploadActor, permission: str, target: Membership) -> None:
    """Recheck under the caller's organization lock; chosen work context grants no ownership.

    Without a private file there is no trusted personnel context, matching the
    existing org-wide-only session-revocation rule. Existing files additionally
    require coverage of every effective target grant, without mixing dimensions.
    The caller still authorizes the file's actual and proposed work contexts.
    """
    members = Membership.objects.filter(organization=actor.organization).select_related(
        "user", "organization"
    )
    member = members.filter(user_id=actor.user.pk).first()
    current_target = members.filter(pk=target.pk).first()
    if member is None or current_target is None:
        raise NotFound
    grants = [scope for codes, scope in effective_scope(member).grants if permission in codes]
    if not grants:
        raise NotFound
    if not Personnel.objects.filter(
        membership=current_target, organization=actor.organization
    ).exists():
        if not any(
            scope["centers"]["mode"] == scope["quadrants"]["mode"] == "all" for scope in grants
        ):
            raise NotFound
        return
    for codes, scope in effective_scope(current_target).grants:
        if codes and not any(_covers_scope(grant, scope) for grant in grants):
            raise NotFound
