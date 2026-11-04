import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user from the first migration so the model can evolve (swapping it later is costly).

    The primary key is a UUID like every other API-visible record. Authentication flows (login,
    tokens, devices) arrive in #4; permissions come from organization memberships, not from here.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
