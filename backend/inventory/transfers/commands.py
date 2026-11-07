"""Typed immutable command boundaries; organization/actor are never supplied by a body."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from uploads.access import UploadActor

if TYPE_CHECKING:
    from inventory.transfers.models import TransferEvent


@dataclass(frozen=True)
class SourceAuthority:
    event_id: UUID
    payload_hash: str
    device_time: datetime
    server_received_at: datetime
    original_actor_id: UUID
    review_context: Any = None


@dataclass(frozen=True)
class TransferAuthority:
    actor: UploadActor
    source: SourceAuthority | None = None


@dataclass(frozen=True)
class PrepareTransferCommand:
    actor: UploadActor
    values: dict[str, Any]


@dataclass(frozen=True)
class DispatchTransferCommand:
    actor: UploadActor
    transfer_id: UUID
    values: dict[str, Any]
    source: SourceAuthority | None = None


@dataclass(frozen=True)
class ReceiveTransferCommand(DispatchTransferCommand):
    pass


@dataclass(frozen=True)
class ResolutionCommand:
    actor: UploadActor
    discrepancy_id: UUID
    values: dict[str, Any]
    source_references: frozenset[UUID] = frozenset()


@dataclass(frozen=True)
class SignedManifest:
    kind: str
    values: dict[str, Any]


@dataclass(frozen=True)
class ResolutionIntent:
    reason: str
    digest: str


@dataclass(frozen=True)
class TransferTransitionResult:
    event: TransferEvent
    is_replay: bool = False
