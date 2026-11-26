"""Ending the web (cookie) sessions of given users, for immediate lockouts.

Sessions live in Django's database store and are not indexed by user, so the unexpired rows are
decoded one by one. Fine for the expected scale (a few hundred live sessions); revisit with a
user index if it grows.
"""

from collections.abc import Iterable
from uuid import UUID

from django.contrib.auth import SESSION_KEY
from django.contrib.sessions.models import Session

from core.time import server_now


def end_web_sessions(user_ids: Iterable[UUID]) -> int:
    """Delete the live web sessions of these users (writes Session); returns how many."""
    wanted = {str(user_id) for user_id in user_ids}
    if not wanted:
        return 0
    doomed = [
        session.pk
        for session in Session.objects.filter(expire_date__gt=server_now()).iterator()
        if str(session.get_decoded().get(SESSION_KEY, "")) in wanted
    ]
    Session.objects.filter(pk__in=doomed).delete()
    return len(doomed)
