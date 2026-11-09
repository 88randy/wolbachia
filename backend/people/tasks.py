"""Single-beat bounded observation; no notification channel is fabricated."""

from uuid import UUID

from celery import shared_task

from people.notices import recover_due_notices, recover_notice


@shared_task  # type: ignore[untyped-decorator]  # Celery has no bundled decorator stubs.
def publish_training_notice(identifier: str) -> bool:
    return recover_notice(UUID(identifier))


@shared_task  # type: ignore[untyped-decorator]  # Celery has no bundled decorator stubs.
def maintain_training_notices() -> dict[str, int]:
    return recover_due_notices()
