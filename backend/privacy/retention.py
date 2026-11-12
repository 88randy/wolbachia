"""W61: what the platform retains today, read from the real settings and schedule.

There is no retention policy model or run receipt yet (gap reported with W61): the rows below are
the two security-metadata jobs that exist (#54), with the periods the server is configured with.
`last_run_at` and `records_processed` stay null until a run receipt is stored.
"""

from typing import Any

from django.conf import settings

# Declared in `CELERY_BEAT_SCHEDULE["prune-ended-token-pairs"]` (crontab 03:30).
NIGHTLY_AT = "03:30"


def retention_overview() -> dict[str, Any]:
    return {
        "nightly_at": NIGHTLY_AT,
        "timezone": settings.CELERY_TIMEZONE,
        "rows": [
            {
                "code": "auth_token_pairs",
                "period_days": settings.AUTH_TOKEN_PAIR_RETENTION_DAYS,
                "action": "delete",
                "last_run_at": None,
                "records_processed": None,
            },
            {
                "code": "session_audit",
                "period_days": settings.AUTH_SESSION_AUDIT_RETENTION_DAYS,
                "action": "unlink",
                "last_run_at": None,
                "records_processed": None,
            },
        ],
    }
