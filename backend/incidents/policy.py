"""Finite escalation and rolling-hour reminders, independent of transport and clocks."""

from datetime import datetime, timedelta

from incidents.exceptions import IncidentConfigurationUnavailableError

TERMINAL_STAGE = 2


def next_stage(current: int, eligible: tuple[bool, ...]) -> int:
    if not eligible[TERMINAL_STAGE]:
        raise IncidentConfigurationUnavailableError
    return next(
        (stage for stage in range(current + 1, TERMINAL_STAGE) if eligible[stage]), TERMINAL_STAGE
    )


def reminder_due(now: datetime, last_reminder: datetime) -> bool:
    return now >= last_reminder + timedelta(hours=1)
