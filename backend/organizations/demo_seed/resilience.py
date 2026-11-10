"""Retry and cleanup helpers so an interrupted seed can simply be run again (dev only)."""

import re
import time
from collections.abc import Callable
from typing import TypeVar

from django.db import connection

T = TypeVar("T")
BUSY_ERROR = re.compile(r"(Busy|InProgress)Error$")
ATTEMPTS = 6
PAUSE_SECONDS = 3.0
STALE_AFTER_SECONDS = 20


def release_stale_sessions() -> int:
    """End this database's sessions left `idle in transaction` by an interrupted run.

    Such a session keeps the try-locks (scheduling, lab, people, sync) of a run that was killed
    halfway, so every later run answers "in progress". Data is untouched: the open transaction
    is rolled back, which the interrupted run never committed anyway.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity "
            "WHERE datname = current_database() AND pid <> pg_backend_pid() "
            "AND state = 'idle in transaction' "
            "AND state_change < now() - make_interval(secs => %s)",
            [STALE_AFTER_SECONDS],
        )
        return int(cursor.fetchone()[0])


def retrying(step: Callable[[], T]) -> T:
    """Run `step`, retrying the try-lock "busy / in progress" errors with a growing pause."""
    for attempt in range(1, ATTEMPTS + 1):
        try:
            return step()
        except Exception as error:
            if not BUSY_ERROR.search(type(error).__name__) or attempt == ATTEMPTS:
                raise
            release_stale_sessions()
            time.sleep(PAUSE_SECONDS * attempt)
    raise RuntimeError("unreachable")
