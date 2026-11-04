import uuid

from django.contrib.auth.tokens import default_token_generator
from django.db.models import Exists, OuterRef, QuerySet
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from accounts.exceptions import InvalidResetTokenError
from accounts.models import Device, DeviceSession, User
from organizations.models import Organization


def list_devices(
    organization: Organization, is_revoked: bool | None = None, user_id: uuid.UUID | None = None
) -> QuerySet[Device]:
    """Devices of an organization, newest first. `user_id` keeps devices that user has logged in on."""
    devices = (
        Device.objects.for_org(organization)
        .select_related("last_user")
        .order_by("-created_at", "id")
    )
    if is_revoked is not None:
        devices = devices.filter(is_revoked=is_revoked)
    if user_id is not None:
        used_by_user = DeviceSession.objects.filter(
            device=OuterRef("pk"), user_id=user_id, organization=organization
        )
        devices = devices.filter(Exists(used_by_user))
    return devices


def users_of_organization(organization: Organization) -> QuerySet[User]:
    """Users with a membership (active or not) in the organization: admins act on all of them."""
    return User.objects.filter(memberships__organization=organization).order_by("username", "pk")


def find_user_for_password_reset(uid: str, token: str) -> User:
    """The active user a reset link belongs to. Any defect gives the same `InvalidResetTokenError`."""
    try:
        user_pk = uuid.UUID(force_str(urlsafe_base64_decode(uid)))
    except ValueError:
        raise InvalidResetTokenError from None
    user = User.objects.filter(pk=user_pk, is_active=True).first()
    if user is None or not default_token_generator.check_token(user, token):
        raise InvalidResetTokenError
    return user
