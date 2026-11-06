"""Internal, source-bound review capability and immutable preparation facts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol
from uuid import UUID

from organizations.scope import EffectiveScope
from reviews.scope import SubjectFacts

if TYPE_CHECKING:
    from field_sync.models import FieldEvent
    from field_sync.registry import EventContext
    from reviews.inspection import ExistingEffect
    from uploads.access import UploadActor


@dataclass(frozen=True)
class SafetyDispositionRequest:
    inspection_id: UUID
    attest_safe_now: bool


@dataclass(frozen=True)
class ReviewAuthorization:
    source_id: UUID
    payload_sha256: str
    historical_scope: EffectiveScope
    proof_ids: tuple[str, ...]
    observations: frozenset[str]
    reviewer_actor: UploadActor | None = None
    owner_facts: dict[str, Any] = field(default_factory=dict)
    pending_code: str | None = None

    def acknowledges(self, ctx: EventContext, code: str) -> bool:
        return (
            ctx.envelope.id == self.source_id
            and ctx.envelope.payload_info.sha256 == self.payload_sha256
            and code in self.observations
        )


@dataclass(frozen=True)
class HandlerPreparation:
    subjects: SubjectFacts = field(default_factory=SubjectFacts)
    dependencies: tuple[dict[str, Any], ...] = ()
    claims: tuple[dict[str, Any], ...] = ()
    pending_code: str | None = None
    owner_facts: dict[str, Any] = field(default_factory=dict)
    observed_codes: tuple[str, ...] = ()


class ReviewAdapter(Protocol):
    reviewable_codes: frozenset[str]

    def prepare_boundary(
        self, ctx: EventContext, data: dict[str, Any]
    ) -> dict[str, Any] | None: ...

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect: ...

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]: ...

    def capture_observations(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        """Plain immutable facts only; an operational rollback may follow immediately."""
        return {}
