"""Pure acceptance policy; a review acknowledgement never creates original authority."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ReviewPolicyFacts:
    source_status: str
    source_code: str
    has_adapter: bool
    has_original_identity: bool
    has_historical_authority: bool
    allowed_observations: frozenset[str]
    mandatory_blockers: tuple[str, ...] = ()


def acceptance_blockers(facts: ReviewPolicyFacts) -> tuple[str, ...]:
    """Reject retroactive authority and unsupported paths before an operational writer."""
    if facts.source_status != "in_review":
        return ("source_rejected",)
    if not facts.has_adapter:
        return ("handler_unavailable",)
    if not facts.has_original_identity or not facts.has_historical_authority:
        return ("authority_history_unavailable",)
    if facts.mandatory_blockers:
        return tuple(dict.fromkeys(facts.mandatory_blockers))
    if facts.source_code not in facts.allowed_observations:
        return ("observation_not_reviewable",)
    return ()


@dataclass(frozen=True)
class ShiftParentFacts:
    materialization: Literal["absent", "complete_owned", "partial", "ambiguous"]
    has_owned_parent: bool
    has_effective_open: bool = False
    is_new_close: bool = False
    has_current_close_authority: bool = False
    has_review_signal: bool = False


def shift_parent_state(
    facts: ShiftParentFacts,
) -> Literal["effective", "closure_only", "pending", "blocked"]:
    """A complete legacy frame can end without authorizing its opening or more work."""
    if not facts.has_owned_parent or facts.materialization in {"partial", "ambiguous"}:
        return "blocked"
    if facts.materialization == "absent":
        return "pending"
    if facts.is_new_close:
        if not facts.has_current_close_authority:
            return "blocked"
        if facts.has_review_signal:
            return "pending"
        return "effective" if facts.has_effective_open else "closure_only"
    return "effective" if facts.has_effective_open else "pending"
