"""A closed captured epoch never grants current work or retroactive authority."""

from field_sync.exceptions import EventNeedsReview
from field_sync.registry import EventContext
from geography.decisions.models import QuadrantClosure
from geography.decisions.policy import POST_CLOSE, PRE_CLOSE_LATE, classify_closed_epoch
from geography.models import SamplingPoint
from geography.selectors import quadrant_version_at
from scheduling.selectors import assignment_at


def observe_epoch(ctx: EventContext, point: SamplingPoint) -> QuadrantClosure | None:
    epoch = quadrant_version_at(point.block.quadrant, ctx.envelope.device_time)
    assignment = assignment_at(point.block.quadrant, ctx.envelope.device_time)
    facts = {
        "version": 1,
        "point_id": str(point.pk),
        "quadrant_version_id": None if epoch is None else str(epoch.pk),
        "assignment_version_id": None if assignment is None else str(assignment.pk),
    }
    closure = (
        None if epoch is None else QuadrantClosure.objects.filter(quadrant_version=epoch).first()
    )
    facts["closure_id"] = None if closure is None else str(closure.pk)
    facts["closed_at"] = None if closure is None else closure.closed_at.isoformat()
    if ctx.review_authorization is not None and closure is not None:
        from reviews.exceptions import ReviewBlockedError

        original = ctx.review_authorization.owner_facts.get("geography_epoch", {})
        observed = {
            key: value for key, value in original.items() if key not in {"closure_id", "closed_at"}
        }
        identity = {
            key: value for key, value in facts.items() if key not in {"closure_id", "closed_at"}
        }
        if observed != identity or not _closure_proved(ctx, closure, original):
            raise ReviewBlockedError(("geography_epoch_proof_unavailable",))
        facts = dict(original)  # A closure appended later is not a new original observation.
    ctx.observed_facts["geography_epoch"] = facts
    return closure


def _closure_proved(ctx: EventContext, closure: QuadrantClosure, original: dict) -> bool:
    if original.get("closure_id") is None:
        return ctx.server_received_at < closure.closed_at
    return (
        original.get("closure_id") == str(closure.pk)
        and original.get("closed_at") == closure.closed_at.isoformat()
    )


def capture_epoch(ctx: EventContext, point: SamplingPoint) -> None:
    closure = observe_epoch(ctx, point)
    if closure is None:
        return
    code = classify_closed_epoch(
        ctx.envelope.device_time, ctx.server_received_at, closure.closed_at
    )
    if code == POST_CLOSE:
        raise EventNeedsReview(POST_CLOSE)
    if code == PRE_CLOSE_LATE and not ctx.acknowledges(PRE_CLOSE_LATE):
        raise EventNeedsReview(PRE_CLOSE_LATE)
    # An authorized historical acceptance only calls the existing capture handler.
    # It does not publish geometry, make tasks, or change this immutable closure.
